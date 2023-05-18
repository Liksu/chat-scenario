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
    }
}




export type OldAct = string
export type OldScenarioMessage = Record<string, string>
export type OldScenarioMessages = Array<OldScenarioMessage>
export type OldScenarioPlaceholders = Array<string>
export type OldScenarioConfigValue = string | number | boolean | Array<string>
export interface OldScenarioData {
    [order: symbol]: Array<string> | OldScenarioActConfig
    [act: OldAct]: OldScenarioMessages & Record<symbol, OldScenarioPlaceholders>
}
export type OldScenarioContextObject = Record<string, string | null>
export type OldScenarioAction = (content: string, act: OldAct, scenario: OldScenarioData, instance: ScenarioData) => OldScenarioMessage | null | void
export type OldScenarioActions = Record<string, OldScenarioAction>
export type OldScenarioGlobalConfig = {
    roleKey: string
    contentKey: string
    join: string
    comment: string
    actions: OldScenarioActions
} & Record<string, OldScenarioConfigValue | OldScenarioActions>
export type OldScenarioActConfig = Record<string, OldScenarioConfigValue>