import {
    ActData,
    ActName,
    DeepPartial,
    ScenarioConfig,
    ScenarioContext,
    ScenarioData,
    ScenarioMessage,
    ScenarioParserConfig
} from './interfaces'
import ScenarioParser from './parser'
import { deepGet, inherit, PLACEHOLDERS_REGEXP } from './utils'

export default class Scenario<RoleKey extends string = 'role', ContentKey extends string = 'content'> {
    public scenario: ScenarioData<RoleKey, ContentKey>
    public defaultAct: ActName
    public defaultPlaceholder: string = '???'
    
    constructor(scenario: ScenarioData<RoleKey, ContentKey> | string, config?: DeepPartial<ScenarioParserConfig>) {
        this.scenario = typeof scenario === 'string'
            ? new ScenarioParser<RoleKey, ContentKey>(scenario, config).scenario
            : scenario
        
        this.defaultAct = this.scenario.config.parserOverrides?.keys?.defaultAct
            ?? ScenarioParser.config.keys.defaultAct
        
        this.defaultPlaceholder = (
            config?.defaultPlaceholder
            ?? this.scenario.config.parserOverrides?.defaultPlaceholder
            ?? this.defaultPlaceholder
        ) as string
    }

    public build(context: ScenarioContext, act = this.defaultAct): ScenarioMessage<RoleKey, ContentKey>[] {
        const roleKey = (this.scenario.config.parserOverrides?.keys?.role ?? ScenarioParser.config.keys.role) as RoleKey
        const contentKey = (this.scenario.config.parserOverrides?.keys?.content ?? ScenarioParser.config.keys.content) as ContentKey
        const comment = this.scenario.config.parserOverrides?.comment ?? ScenarioParser.config.comment
        
        return this.scenario.acts[act].messages
            ?.filter(message => !message[roleKey].startsWith(comment))
            .map(message => ({
                [roleKey]: this.scenario.config.rolePlaceholders
                    ? this.replacePlaceholders(message[roleKey], context, act)
                    : message[roleKey],
                [contentKey]: this.replacePlaceholders(message[contentKey], context, act)
            } as ScenarioMessage<RoleKey, ContentKey>)) ?? []
    }

    private replacePlaceholders(content: string, context: ScenarioContext, act: ActName = this.defaultAct): string {
        return content.replace(
            PLACEHOLDERS_REGEXP,
            (_, key) => deepGet(context, key) ?? this.scenario.acts[act].placeholders[key] ?? this.defaultPlaceholder
        )
    }
    
    private getConfigsChain(act?: ActName): ScenarioConfig[] {
        const chain = [this.scenario.acts[this.defaultAct]?.config, this.scenario.config]
        if (act && act !== this.defaultAct) chain.unshift(this.scenario.acts[act]?.config)
        return chain.filter(Boolean)
    }

    public getActPlaceholders(act: ActName): string[] {
        return Object.keys(this.scenario.acts[act]?.placeholders ?? {})
    }

    public getActConfig(act: ActName, inherited = true): ScenarioConfig | null {
        const chain = this.getConfigsChain(act)
        if (!inherited) return chain[0] ?? null

        return inherit<ScenarioConfig>(...chain)
    }
    
    public inheritConfigs(context?: ScenarioContext, act?: ActName): ScenarioContext {
        const chain = this.getConfigsChain(act)
        return inherit<ScenarioContext>(context ?? {}, ...chain) as ScenarioContext
    }

    public getActsMap(scenario?: ScenarioData<RoleKey, ContentKey> | null): Map<ActName, ActData<RoleKey, ContentKey>>
    public getActsMap(scenario: ScenarioData<RoleKey, ContentKey> | null, messagesOnly: true): Map<ActName, ScenarioMessage[]>
    public getActsMap(scenario: ScenarioData<RoleKey, ContentKey> | null, messagesOnly: false): Map<ActName, ActData<RoleKey, ContentKey>>
    public getActsMap(scenario: ScenarioData<RoleKey, ContentKey> | null = this.scenario, messagesOnly: boolean = false): Map<ActName, ActData<RoleKey, ContentKey>> | Map<ActName, ScenarioMessage[]> {
        if (!scenario) scenario = this.scenario
        const source: Array<[ActName, ActData<RoleKey, ContentKey>]> = scenario.config.order.map(act => [act, this.scenario.acts[act]])

        if (messagesOnly) {
            return new Map(source.map(([act, {messages}]) => [act, messages])) as Map<ActName, ScenarioMessage[]>
        }

        return new Map(source)
    }

}