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
    input: ScenarioMessage<RoleKey, ContentKey>[] | ScenarioContext[] | unknown,
    state: ScenarioState<RoleKey, ContentKey>,
    scenario: Scenario<RoleKey, ContentKey>,
    manager: HistoryManager<RoleKey, ContentKey>
) => ScenarioMessage<RoleKey, ContentKey>[] | ScenarioContext[] | void

export type HistoryManagerHookName = 'afterInit' | 'afterLoad' | 'beforeSave'
    | 'beforeClearContext' | 'beforeNext' | 'afterBuild' | 'beforeGetMessages'
    | 'beforePrintHistory' | 'beforePushMessage' | 'beforePushContext' | 'getActQueue'
    | 'beforeGetContexts' | 'nextReturns'

export interface HistoryManagerConfig<RoleKey extends string = 'role', ContentKey extends string = 'content'> {
    actions?: Record<string, ScenarioAction<RoleKey, ContentKey>>
    hooks?: Partial<Record<HistoryManagerHookName, ScenarioHook<RoleKey, ContentKey>[]>>
    fullLog?: boolean
    costOnly?: boolean
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

export interface ScenarioInteractionLogItem {
    datetime: number
    request: unknown,
    response: unknown,
}

export type ScenarioInteractionLog = ScenarioInteractionLogItem[]

export interface ScenarioState<RoleKey extends string = 'role', ContentKey extends string = 'content'> {
    scenario: ScenarioData<RoleKey, ContentKey> | null
    act: ActName | null
    /**
     * The main history of processed messages
     * The result of scenario processing
     */
    history: ScenarioMessage<RoleKey, ContentKey>[]
    /**
     * The history of contexts that is useful to represent dialog to the user:
     * user input -> assistant response -> user input -> assistant response -> ...
     * as user context made from placeholders and assistant synthetic context made from its answer
     */
    contexts: ScenarioContext[]
    /**
     * List of the next acts to process
     */
    queue: ActName[] | null
    /**
     * Global context that updates on each execution of the scenario and stores as much data as possible
     * It is used to build each act, so if you need to build only with the act context,
     * you can use the `clearContext()` method before the `execute()` or `next()` methods
     */
    context: ScenarioContext
    log?: ScenarioInteractionLog
    cost?: HistoryCost
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
        /**
         * The priority of actors for each act
         * @default ['user', 'assistant']
         * 
         * Usually all acts requires user's input as a context, so the queue of processing should be:
         * user input -> moving to next act, build its messages with the user context
         * -> request assistant with the whole history
         * -> push the answer to the history
         * -> output the answer to the user
         * 
         * So, the user is always between the acts - the result of the previous act is the AI's answer to the user
         * And the only one difference to make user fills it as vice versa is to skip the input for the first act.
         * Then, AI will be prompted first with the messages of the first act, and then the user will receive the answer
         * as the prompt for the second act.
         * 
         * In fact, to skip the input for the first act, you can just set the priority of the scenario to ['assistant'],
         * or just 'assistant':
         * @example
         *   % use priority assistant
         *   % use priority assistant, user
         */
        priority?: string[] | string
        parserOverrides?: DeepPartial<ScenarioParserConfig>
        rolePlaceholders?: boolean
    }
}

export type DeepPartial<T> = T extends object
    ? { [P in keyof T]?: DeepPartial<T[P]> }
    : T

export type extractCostGeneric<Type> = Type extends HistoryCost<infer X> ? X : never
