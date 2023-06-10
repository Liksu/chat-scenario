import {
    ActData,
    ActName,
    DeepPartial, extractCostGeneric,
    HistoryCost, HistoryCostItem,
    HistoryManagerConfig, ScenarioAction,
    ScenarioConfig, ScenarioContext,
    ScenarioData, ScenarioMessage, ScenarioParserConfig, ScenarioPlugin,
    ScenarioState
} from './interfaces'
import Scenario from './scenario'
import { mergeContexts } from './utils'

export default class HistoryManager<RoleKey extends string = 'role', ContentKey extends string = 'content'> {
    public config: HistoryManagerConfig<RoleKey, ContentKey>
    
    public state: ScenarioState<RoleKey, ContentKey> | null = null
    public scenario: Scenario<RoleKey, ContentKey> | null = null

    constructor(config: HistoryManagerConfig<RoleKey, ContentKey>) {
        this.config = config
    }
    
    public init(scenario: string | ScenarioData<RoleKey, ContentKey>, parserConfig?: DeepPartial<ScenarioParserConfig>) {
        this.scenario = new Scenario<RoleKey, ContentKey>(scenario, parserConfig)
        this.state = {
            scenario: this.scenario.scenario,
            act: null,
            history: [],
            context: {},
            cost: {
                requests: [],
                totalTokens: 0,
            } as HistoryCost,
        }
    }
    
    public load(scenario: ScenarioState<RoleKey, ContentKey>) {
        this.scenario = new Scenario<RoleKey, ContentKey>(scenario.scenario as ScenarioData<RoleKey, ContentKey>)
        this.state = scenario
    }
    
    public save(): ScenarioState<RoleKey, ContentKey> | null {
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
        this.runPlugins(messages)

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
    
    public addAnswer(messages: ScenarioMessage<RoleKey, ContentKey> | ScenarioMessage<RoleKey, ContentKey>[]) {
        if (!Array.isArray(messages)) messages = [messages]
        this.state?.history.push(...messages)
    }

    public addCost(cost: HistoryCostItem): number | null {
        if (!this.state) return null
        
        this.state.cost.requests.push(cost)
        this.state.cost.totalTokens += cost.total_tokens
        
        return this.state.cost.totalTokens
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

        return this.state.history
            .filter(message => !skipRoles.includes(message[roleKey]))
            .map(message => `${message[roleKey]}:\n\t${message[contentKey].replace(/\n/g, '\n\t')}`)
            .join('\n\n')
    }

    private runPlugins(messages: ScenarioMessage<RoleKey, ContentKey>[]) {
        this.config.plugins?.forEach(plugin => {
            if (!this.state || !this.scenario) return
            const result = plugin(messages, this.state, this.scenario, this)
            if (result) messages = result
        })
    }
    
    private buildMessages(): ScenarioMessage<RoleKey, ContentKey>[] {
        if (!this.state || !this.scenario || !this.state.act) return []
        
        const { roleKey, contentKey } = this.scenario
        
        return this.scenario.build(this.state.context, this.state.act)
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
    }
}