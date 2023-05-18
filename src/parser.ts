import {
    ActData,
    ActName,
    ScenarioConfig,
    ScenarioConfigRecognizedValue,
    ScenarioData, ScenarioMessage,
    ScenarioParserConfig
} from './interfaces'
import {
    ACT_BRACKETS_REGEXP,
    BLOCK_SPLITTER_REGEXP,
    CHECK_ACT_REGEXP,
    DEFAULT_CONTENT_REGEXP,
    LINE_SPLITTER_REGEXP,
    CONFIG_REGEXP,
    restoreType, CONFIG_LINE_REGEXP,
} from './utils'

export default class ScenarioParser<RoleKey extends string = 'role', ContentKey extends string = 'content'> {
    public raw?: string
    public scenario: ScenarioData<RoleKey, ContentKey> = {
        acts: {},
        config: {
            order: [],
        },
    }

    public config: ScenarioParserConfig = {
        join: ' ',
        comment: '#',
        newLine: '\\',
        keys: {
            role: 'role',
            content: 'content',
            defaultAct: 'default',
        }
    }

    constructor(text?: string | ScenarioParserConfig, config?: ScenarioParserConfig) {
        if (typeof text === 'object') [text, config] = [undefined, text]
        
        if (config) {
            this.config = {
                ...this.config,
                ...config,
                keys: {
                    ...this.config.keys,
                    ...config.keys
                }
            }
        }
        
        if (text) {
            this.raw = text
            this.scenario = this.parse()
        }
    }

    /**
     * if a text parameter is passed, it works idempotently - inheriting but
     * not changing the parser object, returns but does not save the script.
     * if not passed, processes the text passed to the constructor, modifying
     * the configuration and saving the script.
     * 
     * @param {String} [scenarioText] - text to parse
     * @returns {ScenarioData}
     */
    parse(scenarioText?: string): ScenarioData<RoleKey, ContentKey> {
        let parserConfig: ScenarioParserConfig
        let text: string
        
        if (!scenarioText) {
            if (!this.raw) return this.scenario
            
            text = this.raw.trim()
            parserConfig = this.config
        } else {
            text = scenarioText.trim()
            parserConfig = JSON.parse(JSON.stringify(this.config)) // structuredClone are not available in nodejs version <17
        }
        
        // remove windows line endings
        text = text.replace(/\r/g, '')

        const scenario: ScenarioData<RoleKey, ContentKey> = {
            acts: {},
            config: {
                order: [],
            },
        }

        let act = this.config.keys.defaultAct

        // extract default config that has no act
        const defaultContent = CHECK_ACT_REGEXP.test(text) ? text.match(DEFAULT_CONTENT_REGEXP)?.[1] : text
        if (defaultContent?.trim()) {
            const cleanContent = this.extractConfig(defaultContent, scenario, act, parserConfig)
            text = text.replace(defaultContent, cleanContent)
        }

        // parse text block by block
        text
            .split(BLOCK_SPLITTER_REGEXP)
            .forEach(textBlock => {
                const [head, ...body] = textBlock.split(LINE_SPLITTER_REGEXP)

                // extract new act, it's config and description
                if (/\[.*]/.test(head)) {
                    act = head.replace(ACT_BRACKETS_REGEXP, '') || parserConfig.keys.defaultAct
                    if (act.startsWith(parserConfig.comment)) return null

                    let description = body
                        .filter(line => !line.startsWith(parserConfig.comment))
                        .join('\n')

                    description = this.extractConfig(description, scenario, act, parserConfig)
                    this.createAct(scenario, act, description)
                    return null
                }

                // skip commented blocks and acts
                if (head.startsWith(parserConfig.comment) || act.startsWith(parserConfig.comment)) {
                    return null
                }

                // checking for scenario's act existence just in case
                this.createAct(scenario, act)
                
                // because the parser config can be changed with the new act, we need to recreate the newLine regexp
                const newLineRe = this.getNewLineRe(parserConfig)

                // store message
                const role = head.replace(/:\s*$/, '').trim()

                const content = body
                    .filter(line => !line.startsWith(parserConfig.comment))
                    .join(parserConfig.join ?? ' ')
                    .replace(newLineRe, '\n')
                    .replace(/\{([^}]+?)}/g, (_, name) => '{' + this.storePlaceholder(scenario, act, name) + '}')

                scenario.acts[act].messages.push({
                    [parserConfig.keys.role || 'role']: role,
                    [parserConfig.keys.content || 'content']: content
                } as ScenarioMessage<RoleKey, ContentKey>)
            })

        if (!scenarioText) this.scenario = scenario
        return scenario
    }

    private getNewLineRe(parserConfig: ScenarioParserConfig): RegExp {
        const newLine = parserConfig.newLine?.replace(/\\/g, '\\\\') ?? '\\\\'
        const join = parserConfig.join?.replace(/\\/g, '\\\\') ?? ' '
        return new RegExp(newLine + join + '+', 'g')
    }

    private extractConfig(text: string, scenario: ScenarioData<RoleKey, ContentKey>, act: ActName, parserConfig: ScenarioParserConfig): string {
        return text.replace(CONFIG_REGEXP, (_, directive: string) => {
            // change the parsed behavior
            if (directive.startsWith('parse ')) {
                const [parse, key, ...values] = directive.split(/\s+/)
                const value = values.join(' ').trim()
                this.updateConfig(parserConfig, key, value)
                this.updateConfig(scenario.config, `parserOverrides.${key}`, value)
                return ''
            }

            // store the scenario config
            if (directive.startsWith('use ')) {
                const [use, key, ...values] = directive.split(/\s+/)
                this.updateConfig(scenario.config, key, values.join(' ').trim())
                return ''
            }

            // parse and store config line
            if (/=/.test(directive)) {
                let {key, value} = directive.match(CONFIG_LINE_REGEXP)?.groups ?? {}
                if (!key) return ''

                let config
                if (key.startsWith('scenario.')) {
                    // store the scenario config
                    config = scenario.config
                    key = key.replace('scenario.', '')
                } else if (key.startsWith('parser.')) {
                    // change the parsed behavior
                    config = parserConfig
                    key = key.replace('parser.', '')
                    this.updateConfig(scenario.config, `parserOverrides.${key}`, value)
                } else if (key.startsWith('act.')) {
                    // for an act config, remove the prefix if any
                    key = key.replace('act.', '')
                }
                
                // if config variable was not assigned, it's an act config 
                if (!config) {
                    this.createAct(scenario, act)
                    config = scenario.acts[act].config
                }
                
                this.updateConfig(config, key, value)
                return ''
            }

            // store directives
            if (/^\w+$/.test(directive)) {
                this.createAct(scenario, act)
                this.updateConfig(scenario.acts[act].config, directive, true)
                return ''
            }

            return ''
        })
    }

    private updateConfig(config: ScenarioConfig, key: string, value: ScenarioConfigRecognizedValue) {
        let configRef: any = config
        let configKey = key.trim()

        if (/\./.test(key)) {
            const parts = key.split('.')
            configKey = parts.pop() as string
            configRef = parts.reduce((ref, key) => {
                if (!ref[key]) ref[key] = {}
                return ref[key]
            }, configRef)
        }

        configRef[configKey] = typeof value === 'string' ? restoreType(value) : value
    }
    
    private createAct(scenario: ScenarioData<RoleKey, ContentKey>, act: ActName, description?: string) {
        if (scenario.acts[act]) return;
        
        scenario.acts[act] = {
            config: {},
            hasPlaceholders: false,
            placeholders: {},
            messages: []
        } as ActData<RoleKey, ContentKey>
        if (description) scenario.acts[act].description = description

        scenario.config.order.push(act)
    }
    
    private storePlaceholder(scenario: ScenarioData<RoleKey, ContentKey>, act: ActName, placeholder: string): string {
        const [placeholderName, ...defaultValues] = placeholder.split(/\s*\|\s*/)
        this.createAct(scenario, act)
        scenario.acts[act].placeholders[placeholderName] = restoreType(defaultValues.join(' ').trim(), false) || null
        scenario.acts[act].hasPlaceholders = true
        return placeholderName
    }
    
    getActPlaceholders(act: ActName): string[] {
        return Object.keys(this.scenario.acts[act]?.placeholders ?? {})
    }
    
    getActConfig(act: ActName): ScenarioConfig {
        return this.scenario.acts[act]?.config
            ?? this.scenario.acts[this.config.keys.defaultAct]?.config
            ?? {}
    }

    getActsMap(scenario?: ScenarioData<RoleKey, ContentKey> | null): Map<ActName, ActData<RoleKey, ContentKey>>
    getActsMap(scenario: ScenarioData<RoleKey, ContentKey> | null, messagesOnly: true): Map<ActName, ScenarioMessage[]>
    getActsMap(scenario: ScenarioData<RoleKey, ContentKey> | null, messagesOnly: false): Map<ActName, ActData<RoleKey, ContentKey>>
    getActsMap(scenario: ScenarioData<RoleKey, ContentKey> | null = this.scenario, messagesOnly: boolean = false): Map<ActName, ActData<RoleKey, ContentKey>> | Map<ActName, ScenarioMessage[]> {
        if (!scenario) scenario = this.scenario
        const source: Array<[ActName, ActData<RoleKey, ContentKey>]> = scenario.config.order.map(act => [act, this.scenario.acts[act]])
        
        if (messagesOnly) {
            return new Map(source.map(([act, {messages}]) => [act, messages])) as Map<ActName, ScenarioMessage[]>
        }
        
        return new Map(source)
    }
}