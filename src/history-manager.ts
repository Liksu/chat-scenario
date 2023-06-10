import {
    ActName,
    DeepPartial, extractCostGeneric,
    HistoryCost, HistoryCostItem,
    HistoryManagerConfig, ScenarioAction,
    ScenarioConfig, ScenarioContext,
    ScenarioData, ScenarioMessage, ScenarioParserConfig,
    ScenarioState
} from './interfaces'
import Scenario from './scenario'
import { mergeContexts } from './utils'

export default class HistoryManager<RoleKey extends string = 'role', ContentKey extends string = 'content'> {
    public config: HistoryManagerConfig
    
    public state: ScenarioState<RoleKey, ContentKey> | null = null
    public scenario: Scenario<RoleKey, ContentKey> | null = null

    constructor(config: HistoryManagerConfig) {
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
    
    public execute(context: ScenarioContext, act?: ActName): ScenarioMessage<RoleKey, ContentKey>[] | null {
        if (!this.state || !this.scenario) return null

        this.state.act = act ?? this.scenario.defaultAct ?? this.state.scenario?.config.order[0]
        if (this.state.act == null) return null
        
        this.state.context = mergeContexts(this.state.context, context)
        
        const messages = this.buildMessages()
        if (!messages.length) return null
        
        this.state.history.push(...messages)
        return messages
    }
    
    public addCost(cost: HistoryCostItem): number | null {
        if (!this.state) return null
        
        this.state.cost.requests.push(cost)
        this.state.cost.totalTokens += cost.total_tokens
        
        return this.state.cost.totalTokens
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
    
    // public start(actNumber: number)
}