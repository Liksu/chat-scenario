type Act = string

export type ScenarioMessage = Record<string, string>
export type ScenarioMessages = Array<ScenarioMessage>
export interface ScenarioData {
    [order: symbol]: Array<string>
    [act: Act]: ScenarioMessages & Record<symbol, Array<string>>
}
export type ScenarioContextObject = Record<string, string | null>
export type ScenarioAction = (content: string, act: Act, scenario: ScenarioData, instance: Scenario) => ScenarioMessage | null | void
export type ScenarioActions = Record<string, ScenarioAction>
export type ScenarioConfig = {
    roleKey: string
    contentKey: string
    join: string
    comment: string
    actions: ScenarioActions
} & Record<string, string | number | boolean | Array<string> | ScenarioActions>

export default class Scenario {
    static orderSymbol: symbol
    static placeholderSymbol: symbol
    static defaultAct: string
    
    static directiveValues: ScenarioConfig
    
    public scenario: ScenarioData
    public config: ScenarioConfig

    public history: ScenarioMessages
    public act: Act | null
    public context: ScenarioContextObject
    public queue: Array<Act>
    
    public constructor(text: string, config?: ScenarioConfig)
    public prepare(text: string): ScenarioData
    public extractConfig(text: string): string
    public build(context: ScenarioContextObject, act?: Act): ScenarioMessages
    public execute(context: ScenarioContextObject, act?: Act): ScenarioMessages
    
    public start(context: ScenarioContextObject): ScenarioMessages
    public start(): Scenario
    public start(actIndex: number): Scenario
    public start(actName: string): Scenario
    
    public get hasNext(): Act | null
    public get nextPlaceholders(): ScenarioConfig[Act]
    
    public next(context: ScenarioContextObject, returnHistory?: boolean): ScenarioMessages
    public answer(answer: ScenarioMessage): void
    public end(): void

    public clear(): void    
}
