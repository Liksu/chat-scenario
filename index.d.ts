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

export default class Scenario {
    static orderSymbol: symbol
    static defaultAct: string
    
    public scenario: ScenarioData

    public chat: ScenarioMessages
    public act: Act | null
    public context: ScenarioContextObject
    public queue: Array<Act>
    
    public constructor(text: string)
    public prepare(text: string): ScenarioData
    public build(context: ScenarioContextObject, act?: Act): ScenarioMessages
    public execute(context: ScenarioContextObject, act?: Act): ScenarioMessages
    
    public start(context: ScenarioContextObject): ScenarioMessages
    public next(context: ScenarioContextObject, returnChat?: boolean): ScenarioMessages
    public answer(answer: ScenarioMessage): void
    public end(): void

    public clear(): void    
}
