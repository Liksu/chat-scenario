import {
    ActData,
    ActName,
    DeepPartial,
    HistoryCostItem,
    HistoryManagerConfig,
    HistoryManagerHooks,
    ScenarioAction,
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
    
    public state: ScenarioState<RoleKey, ContentKey> | null = null
    public scenario: Scenario<RoleKey, ContentKey> | null = null

    constructor(config?: HistoryManagerConfig<RoleKey, ContentKey>) {
        this.config = Object.assign(
            {fullLog: false, costOnly: false},
            config ?? {}
        )
    }
    
    public init(scenario: string | ScenarioData<RoleKey, ContentKey>, parserConfig?: DeepPartial<ScenarioParserConfig>) {
        this.scenario = new Scenario<RoleKey, ContentKey>(scenario, parserConfig)
        this.state = {
            scenario: this.scenario.scenario,
            act: null,
            history: [] as ScenarioMessage<RoleKey, ContentKey>[],
            context: {} as ScenarioContext,
        }

        if (this.config.fullLog) {
            this.state.log = []
        }

        if (this.config.costOnly) {
            this.state.cost = {
                requests: [],
                totalTokens: 0,
            }
        }
        
        this.runHooks('afterInit')
        return this
    }
    
    public load(scenario: ScenarioState<RoleKey, ContentKey>) {
        this.scenario = new Scenario<RoleKey, ContentKey>(scenario.scenario as ScenarioData<RoleKey, ContentKey>)
        this.state = scenario
        this.runHooks('afterLoad')
        return this
    }
    
    public save(): ScenarioState<RoleKey, ContentKey> | null {
        this.runHooks('beforeSave')
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

        this.state.act = act ?? this.currentAct
        if (this.state.act == null) return null
        
        this.state.context = mergeContexts(this.state.context, context ?? {})
        
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
        
        this.state.act = this.nextAct
        if (this.state.act == null) return null
        
        const messages = this.execute(context ?? {}, this.state.act)
        return returnHistory ? this.state.history : messages
    }
    
    public getRequest(act?: ActName): ScenarioMessage<RoleKey, ContentKey>[] | null {
        const requestAct = act ?? this.currentAct
        if (!this.state || !this.scenario || !requestAct) return null

        return this.runHooks('beforeRequest', this.state.history)
    }
    
    public addAnswer(messages: ScenarioMessage<RoleKey, ContentKey> | ScenarioMessage<RoleKey, ContentKey>[]) {
        if (!Array.isArray(messages)) messages = [messages]
        this.runHooks('beforeAddAnswer', messages)
        this.state?.history.push(...messages)
    }

    public addCost(cost: HistoryCostItem): number | null {
        if (!this.state) return null
        if (!this.config.costOnly) return null
        if (!this.state.cost) this.state.cost = {requests: [], totalTokens: 0}
        
        this.state.cost.requests.push(cost)
        this.state.cost.totalTokens += cost.total_tokens
        
        return this.state.cost.totalTokens
    }
    
    public log(request: unknown, response: unknown) {
        if (!this.state || !this.config.fullLog) return
        if (!this.state.log) this.state.log = []
        
        this.state.log.push({
            datetime: Date.now(),
            request,
            response,
        })
    }

    public get currentAct(): ActName | null {
        return this.state?.act ?? this.state?.scenario?.config.order[0] ?? this.scenario?.defaultAct ?? null
    }
    
    public get currentActData(): ActData<RoleKey, ContentKey> | null {
        return this.getActData(this.currentAct)
    }

    public get queue(): ActName[] {
        const act = this.currentAct
        if (!act) return []
        
        const order = this.state?.scenario?.config.order
        if (!order) return []
        
        let index = order.indexOf(act)
        if (index === -1) return []
        return order.slice(index + 1)
    }

    public get hasNext(): boolean {
        return this.queue.length > 0
    }
    
    public get nextAct(): ActName | null {
        return this.queue[0] ?? null
    }
    
    public get nextActData(): ActData<RoleKey, ContentKey> | null {
        return this.getActData(this.nextAct)
    }
    
    public getActData(act: ActName | null): ActData<RoleKey, ContentKey> | null {
        if (!act) return null
        return this.state?.scenario?.acts[act] ?? null
    }

    public printHistory(skipRoles: string | string[] = []): string | null {
        if (!Array.isArray(skipRoles)) skipRoles = [skipRoles]
        if (!this.state || !this.scenario) return null
        const { roleKey, contentKey } = this.scenario

        this.runHooks('beforePrintHistory')
        
        return this.state.history
            .filter(message => !skipRoles.includes(message[roleKey]))
            .map(message => `${message[roleKey]}:\n\t${message[contentKey].replace(/\n/g, '\n\t')}`)
            .join('\n\n')
    }

    private runHooks(stage: HistoryManagerHooks, messages: ScenarioMessage<RoleKey, ContentKey>[] = this.state?.history || []): ScenarioMessage<RoleKey, ContentKey>[] {
        return this.config.hooks?.[stage]?.reduce((messages, hook) => {
            if (!this.state || !this.scenario) return messages
            return hook(messages, this.state, this.scenario, this) || messages
        }, messages) ?? messages
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