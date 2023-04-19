type Act = string

export interface ScenarioMessage {
    role: string
    content: string
}
export type ScenarioMessages = Array<ScenarioMessage>
export interface ScenarioData {
    [order: symbol]: Array<string>
    [act: Act]: ScenarioMessages
}
export type ScenarioContextObject = {[name: string]: string | null}
export type ScenarioConfig = {[key: string]: string | number | boolean | Array<string>}

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
    
    public get hasNext(): boolean
    public get nextPlaceholders(): ScenarioConfig[Act]
    
    public next(context: ScenarioContextObject, returnHistory?: boolean): ScenarioMessages
    public answer(answer: ScenarioMessage): void
    public end(): void

    public clear(): void    
}
