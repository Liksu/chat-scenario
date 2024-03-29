import {
    ActData,
    ActName,
    DeepPartial,
    HistoryCostItem,
    HistoryManagerConfig,
    HistoryManagerHookName,
    ScenarioAction,
    ScenarioConfigValue,
    ScenarioContext,
    ScenarioData,
    ScenarioMessage,
    ScenarioParserConfig,
    ScenarioState
} from './interfaces.js'
import Scenario from './scenario.js'
import { mergeContexts } from './utils.js'

export default class HistoryManager<RoleKey extends string = 'role', ContentKey extends string = 'content'> {
    public config: HistoryManagerConfig<RoleKey, ContentKey>
    public stash: any
    
    public state: ScenarioState<RoleKey, ContentKey> | null = null
    public scenario: Scenario<RoleKey, ContentKey> | null = null

    constructor(config?: HistoryManagerConfig<RoleKey, ContentKey>, stash?: any) {
        this.config = Object.assign(
            {fullLog: false, costOnly: false},
            config ?? {}
        )
        
        this.stash = stash ?? {}
    }
    
    public init(scenario: string | ScenarioData<RoleKey, ContentKey> | Scenario<RoleKey, ContentKey>, parserConfig?: DeepPartial<ScenarioParserConfig>) {
        this.scenario = scenario instanceof Scenario ? scenario : new Scenario<RoleKey, ContentKey>(scenario, parserConfig)
        this.state = {
            scenario: this.scenario.scenario,
            act: null,
            history: [] as ScenarioMessage<RoleKey, ContentKey>[],
            contexts: [] as ScenarioContext[],
            queue: [...(this.scenario.scenario.config.order ?? [])],
            context: {} as ScenarioContext,
        }

        if (this.config.fullLog) {
            this.state.log = []
        }

        if (this.config.costOnly) {
            this.state.cost = {
                requests: [],
                totalTokens: {
                    completion_tokens: 0,
                    prompt_tokens: 0,
                    total_tokens: 0,
                },
            }
        }
        
        this.runHooks('afterInit', this.state.history)
        return this
    }
    
    public load(scenario: ScenarioState<RoleKey, ContentKey>) {
        this.scenario = new Scenario<RoleKey, ContentKey>(scenario.scenario as ScenarioData<RoleKey, ContentKey>)
        this.state = scenario
        this.runHooks('afterLoad', this.state.history)
        return this
    }
    
    public save(): ScenarioState<RoleKey, ContentKey> | null {
        this.runHooks('beforeSave', this.state?.history)
        return this.state
    }

    /**
     * @example
     * ```ts
     * const history = new HistoryManager()
     * history.init(scenario)
     * history.execute({...})
     * history.clearContext().execute({...})
     * ```
     * @returns {HistoryManager}
     */
    public clearContext(): HistoryManager<RoleKey, ContentKey> {
        this.runHooks('beforeClearContext')
        
        if (this.state) {
            this.state.context = {}
        }
        
        return this
    }
    
    public execute(context?: ScenarioContext | ActName, act?: ActName): ScenarioMessage<RoleKey, ContentKey>[] | null {
        if (!this.state || !this.scenario) return null
        if (typeof context === 'string') {
            [act, context] = [context, undefined]
        }
        context ??= {}

        this.state.act = act ?? this.currentAct
        if (this.state.act == null) return null
        
        this.state.context = mergeContexts(this.state.context, context)
        this.state.contexts.push(context)
        
        const messages = this.buildMessages()
        if (messages) this.state.history.push(...messages)
        
        return messages
    }

    /**
     * @deprecated use `next` instead
     */
    public start(context?: ScenarioContext) {
        if (!this.state || !this.scenario) return null
        
        this.state.act = this.currentAct
        if (this.state.act == null) return null
        
        return this.execute(context ?? {}, this.state.act)
    }
    
    public next(context?: ScenarioContext, returnHistory = false): ScenarioMessage<RoleKey, ContentKey>[] | null {
        if (!this.state || !this.scenario) return null

        this.runHooks('beforeNext', this.state.history)

        this.state.act = this.state.queue?.shift() ?? null
        if (this.state.act == null) return null
        
        const messages = this.execute(context ?? {}, this.state.act)
        return returnHistory
            ? this.state.history
            : this.runHooks('nextReturns', messages ?? undefined)
    }
    
    public getMessages(act?: ActName): ScenarioMessage<RoleKey, ContentKey>[] | null {
        const requestAct = act ?? this.currentAct
        if (!this.state || !this.scenario || !requestAct) return null

        return this.runHooks('beforeGetMessages', this.state.history)
    }
    
    public getContexts(): ScenarioContext[] | null {
        return this.runHooks<ScenarioContext>('beforeGetContexts',this.state?.contexts)
    } 
    
    public pushContext(context: ScenarioContext | ScenarioContext[]) {
        if (!Array.isArray(context)) context = [context]
        this.runHooks<ScenarioContext>('beforePushContext', context)
        this.state?.contexts.push(...context)
    }
    
    public pushMessage(messages: ScenarioMessage<RoleKey, ContentKey> | ScenarioMessage<RoleKey, ContentKey>[]) {
        if (!Array.isArray(messages)) messages = [messages]
        this.runHooks('beforePushMessage', messages)
        this.state?.history.push(...messages)
    }

    public addCost(cost: HistoryCostItem): HistoryCostItem | null {
        if (!this.state) return null
        if (!this.config.costOnly) return null
        if (!this.state.cost) {
            this.state.cost = {
                requests: [],
                totalTokens: {
                    completion_tokens: 0,
                    prompt_tokens: 0,
                    total_tokens: 0,
                }
            }
        }
        
        this.state.cost.requests.push(cost)
        
        this.state.cost.totalTokens.total_tokens += cost.total_tokens
        this.state.cost.totalTokens.completion_tokens += cost.completion_tokens
        this.state.cost.totalTokens.prompt_tokens += cost.prompt_tokens
        
        return this.state.cost.totalTokens
    }
    
    public log(request: unknown, response: unknown, rest?: object) {
        if (!this.state || !this.config.fullLog) return
        if (!this.state.log) this.state.log = []
        
        this.state.log.push({
            datetime: Date.now(),
            request,
            response,
            ...(rest || {}),
        })
    }

    public get currentAct(): ActName | null {
        return this.state?.act ?? this.state?.scenario?.config.order[0] ?? this.scenario?.defaultAct ?? null
    }
    
    public get currentActData(): ActData<RoleKey, ContentKey> | null {
        return this.getActData(this.currentAct)
    }

    public getQueue(): ActName[] {
        const act = this.currentAct
        if (!act) return []
        
        const order = this.state?.scenario?.config.order
        if (!order) return []
        
        let index = order.indexOf(act)
        if (index === -1) return []
        return order.slice(index + 1)
    }

    public get hasNext(): boolean {
        if (!this.state?.queue) return false
        const queue = this.runHooks<ActName>('getActQueue', this.state.queue)
        return queue.length > 0
    }
    
    public get nextAct(): ActName | null {
        if (!this.state?.queue) return null
        const queue = this.runHooks<ActName>('getActQueue', this.state.queue)
        return queue[0] ?? null
    }
    
    public get nextActData(): ActData<RoleKey, ContentKey> | null {
        return this.getActData(this.nextAct)
    }
    
    public getActData(act: ActName | null): ActData<RoleKey, ContentKey> | null {
        if (!act) return null
        return this.state?.scenario?.acts[act] ?? null
    }
    
    public getConfigValue(key: string, act?: ActName | null): ScenarioConfigValue | null {
        const config = this.scenario?.getActConfig(act ?? null)
        if (!config) return null
        
        const value = config[key] ?? null
        return value === '' ? true : value
    }

    public printHistory(skipRoles: string | string[] = []): string | null {
        if (!Array.isArray(skipRoles)) skipRoles = [skipRoles]
        if (!this.state || !this.scenario) return null
        const { roleKey, contentKey } = this.scenario

        this.runHooks('beforePrintHistory', this.state.history)
        
        return this.state.history
            .filter(message => !skipRoles.includes(message[roleKey]))
            .map(message => `${message[roleKey]}:\n\t${message[contentKey].replace(/\n/g, '\n\t')}`)
            .join('\n\n')
    }

    private runHooks<Item = ScenarioMessage<RoleKey, ContentKey>>(
        stage: HistoryManagerHookName,
        input: Item[] = []
    ): Item[] {
        return this.config.hooks?.[stage]?.reduce((list, hook) => {
            if (!this.state || !this.scenario) return list
            return (hook(list, this.state, this.scenario, this, stage) as Item[]) || list
        }, input) ?? input
    }

    /**
     * Part of this.execute, builds the messages from the current act
     */
    private buildMessages(): ScenarioMessage<RoleKey, ContentKey>[] {
        if (!this.state || !this.scenario || !this.state.act) return []
        
        const { roleKey, contentKey } = this.scenario
        
        const messages = this.scenario.build(this.state.context, this.state.act)
            .flatMap((message, index) => {
                if (!this.state?.act) return null
                const action = this.config.actions?.[message[roleKey]] as ScenarioAction<RoleKey, ContentKey>
                const messageConfig = this.scenario?.getMessageConfig(this.state.act, index) ?? null
                if (typeof action === 'function') {
                    return action(message[contentKey], messageConfig, this.state.context, this.state.act, this.state)
                }
                return action ?? message
            })
            .filter(Boolean) as ScenarioMessage<RoleKey, ContentKey>[]

        return this.runHooks('afterBuild', messages)
    }
}