import Scenario from './scenario.js'
import HistoryManager from './history-manager.js'

/**
 * Make the parameters more explicit
 */
export type ActName = string

/**
 * This types we can extract from the scenario text
 */
export type ScenarioConfigRecognizedValue = string | number | boolean

/**
 * Object to store the configuration parsed from the scenario text
 */
// export type ScenarioConfig = Record<string, ScenarioConfigRecognizedValue | ScenarioConfigRecognizedValue[]>
export interface ScenarioConfig {
    [key: string]: ScenarioConfigRecognizedValue | ScenarioConfigRecognizedValue[] | ScenarioConfig
}

export type ScenarioAction<RoleKey extends string = 'role', ContentKey extends string = 'content'> = (
    content: string,
    messageConfig: ScenarioConfig | null,
    context: ScenarioContext,
    act: ActName,
    state: ScenarioState<RoleKey, ContentKey>
) => ScenarioMessage<RoleKey, ContentKey> | ScenarioMessage<RoleKey, ContentKey>[] | void | null

export type ScenarioHook<RoleKey extends string = 'role', ContentKey extends string = 'content'> = (
    currentMessages: ScenarioMessage<RoleKey, ContentKey>[],
    state: ScenarioState<RoleKey, ContentKey>,
    scenario: Scenario<RoleKey, ContentKey>,
    manager: HistoryManager<RoleKey, ContentKey>
) => ScenarioMessage<RoleKey, ContentKey>[] | void

export type HistoryManagerHooks = 'afterInit' | 'afterLoad' | 'beforeSave'
    | 'beforeClearContext' | 'afterBuild' | 'beforeRequest' | 'beforePrintHistory' | 'beforeAddAnswer'

export interface HistoryManagerConfig<RoleKey extends string = 'role', ContentKey extends string = 'content'> {
    actions?: Record<string, ScenarioAction<RoleKey, ContentKey>>
    hooks?: Record<HistoryManagerHooks, ScenarioHook<RoleKey, ContentKey>[]>
}

export interface HistoryCostItem {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
}

export interface HistoryCost<Item = HistoryCostItem> {
    requests: Item[]
    totalTokens: number
}

export interface ScenarioState<RoleKey extends string = 'role', ContentKey extends string = 'content'> {
    scenario: ScenarioData<RoleKey, ContentKey> | null
    act: ActName | null
    history: ScenarioMessage<RoleKey, ContentKey>[]
    context: ScenarioContext
    cost: HistoryCost
}

export interface ScenarioContext {
    [key: string]: string | {toString(): string} | ScenarioContext
}

/**
 * Config that describes the output format
 * You can pass it to the ScenarioParser constructor, or set directly in the scenario text
 * It is useful to support different formats of the scenario text just by storing the config in the scenario text
 * 
 * The syntax is:
 * % parse key value
 * The line should start with %, then the world 'parse', then the key and value separated by one or more space symbols,
 * key can contain letters and dot to store the output object key names
 * 
 * @example
 * % parse comment //
 * % parse keys.role sender
 * % parse keys.content message
 * 
 * server:
 *     This is a message from the server
 *     separated into two lines
 *     // this line will be ignored
 * 
 * This will produce the following result:
 * {
 *     sender: 'server',
 *     message: 'This is a message from the server separated into two lines'
 * }
 * 
 * instead of:
 * {
 *     role: 'server',
 *     content: 'This is a message from the server separated into two lines //this line will be ignored'
 * }
 */
export interface ScenarioParserConfig extends ScenarioConfig {
    /**
     * The symbol that will be used to join the lines of message's content in the scenario text
     * By default it is a space
     * 
     * @example
     * % parse join \n
     * 
     * server:
     *     This is a message from the server
     *     separated into two lines
     *    
     * This will produce the following result:
     * {
     *     role: 'server',
     *     content: 'This is a message from the server\nseparated into two lines'
     * }
     */
    join: string

    /**
     * The symbol that will be used to split the lines of message's content
     * By default it is a backslash
     * 
     * @example
     * % parse newLine <br>
     * 
     * server:
     *     This is a message from the server<br>
     *     separated into two lines
     *    
     * This will produce the following result:
     * {
     *     role: 'server',
     *     content: 'This is a message from the server\nseparated into two lines'
     */
    newLine: string
    
    /**
     * The symbol that will be used to mark lines that should be ignored
     * By default it is a hash
     * 
     * @example
     * % parse comment //
     * 
     * server:
     *     // This is a message from the server
     *     separated into two lines
     *    
     * This will produce the following result:
     * {
     *     role: 'server',
     *     content: 'separated into two lines'
     * }
     */
    comment: string
    
    /**
     * The keys that will be used in result objects
     * To set this keys, put in the scenario text the line that starts with % and then 
     */
    keys: {
        /**
         * The key that will be used to store the role of the message
         * By default it is 'role'
         */
        role: string
        
        /**
         * The key that will be used to store the content of the message
         * By default it is 'content'
         */
        content: string
        
        /**
         * The key that will be used to store the default act's name
         * By default it is 'default'
         */
        defaultAct: string
    }
}

/**
 * Object that presents each message in scenario, has two keys - role and content
 * the exact key names can be changed by passing it through generics
 */
export type ScenarioMessage<RoleKey extends string = 'role', ContentKey extends string = 'content'> = Record<RoleKey | ContentKey, string>

export interface ActData<RoleKey extends string = 'role', ContentKey extends string = 'content'> {
    messages: ScenarioMessage<RoleKey, ContentKey>[]
    description?: string
    hasPlaceholders: boolean
    placeholders: Record<string, ScenarioConfigRecognizedValue | null>
    config: ScenarioConfig
}

/**
 * Object to store the whole scenario data that can be stringified and stored
 */
export interface ScenarioData<RoleKey extends string = 'role', ContentKey extends string = 'content'> {
    acts: {
        [act: ActName]: ActData<RoleKey, ContentKey>
    }
    config: ScenarioConfig & {
        order: ActName[]
        parserOverrides?: DeepPartial<ScenarioParserConfig>
        rolePlaceholders?: boolean
    }
}

export type DeepPartial<T> = T extends object
    ? { [P in keyof T]?: DeepPartial<T[P]> }
    : T

export type extractCostGeneric<Type> = Type extends HistoryCost<infer X> ? X : never
