type Act = string

export type ScenarioMessage = Record<string, string>
export type ScenarioMessages = Array<ScenarioMessage>
export type ScenarioPlaceholders = Array<string>
export type ScenarioConfigValue = string | number | boolean | Array<string>
export interface ScenarioData {
    [order: symbol]: Array<string> | ScenarioActConfig
    [act: Act]: ScenarioMessages & Record<symbol, ScenarioPlaceholders>
}
export type ScenarioContextObject = Record<string, string | null>
export type ScenarioAction = (content: string, act: Act, scenario: ScenarioData, instance: Scenario) => ScenarioMessage | null | void
export type ScenarioActions = Record<string, ScenarioAction>
export type ScenarioGlobalConfig = {
    roleKey: string
    contentKey: string
    join: string
    comment: string
    actions: ScenarioActions
} & Record<string, ScenarioConfigValue | ScenarioActions>
export type ScenarioActConfig = Record<string, ScenarioConfigValue>

export default class Scenario {
    static orderSymbol: symbol
    static placeholderSymbol: symbol
    static defaultAct: string
    
    static directiveValues: ScenarioGlobalConfig
    
    public scenario: ScenarioData
    public config: ScenarioGlobalConfig

    public history: ScenarioMessages
    public act: Act | null
    public context: ScenarioContextObject
    public queue: Array<Act>
    
    public constructor(text: string, config?: ScenarioGlobalConfig)
    public prepare(text: string): ScenarioData
    public extractConfig(text: string): string
    public build(context: ScenarioContextObject, act?: Act): ScenarioMessages
    public execute(context: ScenarioContextObject, act?: Act): ScenarioMessages
    
    public start(context: ScenarioContextObject): ScenarioMessages
    public start(): Scenario
    public start(actIndex: number): Scenario
    public start(actName: string): Scenario
    
    public get placeholders(): ScenarioPlaceholders
    public get hasNext(): Act | null
    public get nextPlaceholders(): ScenarioPlaceholders
    public get nextConfig(): ScenarioActConfig
    
    public next(context: ScenarioContextObject, returnHistory?: boolean): ScenarioMessages
    public answer(answer: ScenarioMessage): void
    public end(): void

    public getActConfig(act: Act): ScenarioActConfig | null
    public clear(): void    
}
