import {
    ActData,
    ActName,
    DeepPartial,
    ScenarioConfig,
    ScenarioConfigRecognizedValue,
    ScenarioData,
    ScenarioMessage,
    ScenarioParserConfig
} from './interfaces'
import {
    ACT_BRACKETS_REGEXP,
    BLOCK_SPLITTER_REGEXP,
    CHECK_ACT_REGEXP,
    clone,
    CONFIG_LINE_REGEXP,
    CONFIG_REGEXP,
    deepSet,
    DEFAULT_CONTENT_REGEXP,
    LINE_SPLITTER_REGEXP,
    mergeConfigs,
    PLACEHOLDERS_REGEXP,
    restoreType,
} from './utils'

export default class ScenarioParser<RoleKey extends string = 'role', ContentKey extends string = 'content'> {
    public static config: ScenarioParserConfig = {
        join: ' ',
        comment: '#',
        newLine: '\\',
        keys: {
            role: 'role',
            content: 'content',
            defaultAct: 'default',
        }
    }

    public raw?: string
    public scenario: ScenarioData<RoleKey, ContentKey> = {
        acts: {},
        config: {
            order: [],
        },
    }

    public config: ScenarioParserConfig

    constructor(text?: string | ScenarioParserConfig, config?: DeepPartial<ScenarioParserConfig>) {
        if (typeof text === 'object') [text, config] = [undefined, text]
        
        this.config = mergeConfigs(ScenarioParser.config, config ?? null)
        
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
            parserConfig = clone(this.config)
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
        
        let actMessageIndex = 0

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
                    actMessageIndex = 0
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
                    .filter(line => this.extractConfig(line, scenario, act, parserConfig, actMessageIndex).trim())
                    .join(parserConfig.join ?? ' ')
                    .replace(newLineRe, '\n')
                    .replace(PLACEHOLDERS_REGEXP, (_, name) => '{' + this.storePlaceholder(scenario, act, name) + '}')

                scenario.acts[act].messages.push({
                    [parserConfig.keys.role || 'role']: role,
                    [parserConfig.keys.content || 'content']: content
                } as ScenarioMessage<RoleKey, ContentKey>)

                actMessageIndex++
            })

        if (!scenarioText) this.scenario = scenario
        return scenario
    }

    private getNewLineRe(parserConfig: ScenarioParserConfig): RegExp {
        const newLine = parserConfig.newLine?.replace(/\\/g, '\\\\') ?? '\\\\'
        const join = parserConfig.join?.replace(/\\/g, '\\\\') ?? ' '
        return new RegExp(newLine + join + '+', 'g')
    }

    private storeConfig = (
        directive: string,
        scenario: ScenarioData<RoleKey, ContentKey>,
        act: ActName,
        parserConfig: ScenarioParserConfig,
        index?: number
    ) => {
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
                if (index != null) key = `messages.${index}.${key}`
            }

            this.updateConfig(config, key, value)
            return ''
        }

        // store directives
        if (/^\w+$/.test(directive)) {
            this.createAct(scenario, act)
            if (index != null) directive = `messages.${index}.${directive}`
            this.updateConfig(scenario.acts[act].config, directive, true)
            return ''
        }

        return ''
    }
    
    private extractConfig(text: string, scenario: ScenarioData<RoleKey, ContentKey>, act: ActName, parserConfig: ScenarioParserConfig, index?: number): string {
        return text.replace(
            CONFIG_REGEXP,
            (_, directive) => this.storeConfig(directive, scenario, act, parserConfig, index)
        )
    }

    private updateConfig(config: ScenarioConfig, key: string, value: ScenarioConfigRecognizedValue) {
        deepSet(config, key, typeof value === 'string' ? restoreType(value) : value)
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
}