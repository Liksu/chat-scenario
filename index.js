const COMA_REGEXP = /,(?=(?:[^"]|"[^"]*")*$)/
const DIRECTIVE_REGEXP = /^%\s*(.*)\s*\n?/gm
const BLOCK_SPLITTER_REGEXP = /(?:\s*\n\s*){2,}/m
const LINE_SPLITTER_REGEXP = /\s*\n\s*/m
const ACT_REGEXP = /^\s*\[\s*|\s*]\s*$/g
const DEFAULT_CONTENT_REGEXP = /^(.+?)\n\n\[.+?]\n/s

const tryBoolean = value => value === 'true' ? true : value === 'false' ? false : value
const tryNumber = value => !isNaN(value) && !isNaN(parseFloat(value)) ? parseFloat(value) : tryBoolean(value)
const tryArray = value => COMA_REGEXP.test(value)
                            ? value.split(COMA_REGEXP).map(item => tryNumber(item.trim()))
                            : tryNumber(value)

export default class Scenario {
    static orderSymbol = Symbol('order')
    static placeholderSymbol = Symbol('placeholder')
    static configSymbol = Symbol('config')
    static defaultAct = 'default'

    static directiveValues = {
        'new_line': '\n',
    }
    
    scenario = {}
    config = {
        join: ' ',
        comment: '#',
        roleKey: 'role',
        contentKey: 'content',
        actions: {},
    }
    
    history = []
    act = null
    context = {}
    queue = []

    constructor(text, config = {}) {
        Object.assign(this.config, config)
        this.scenario = this.prepare(text)
    }

    prepare(text) {
        text = text.replace(/\r/g, '')
        
        const scenario = {
            [Scenario.orderSymbol]: [],
        }
        let act = Scenario.defaultAct
        
        // extract default config that has no act
        const defaultContent = DEFAULT_CONTENT_REGEXP.exec(text)?.[1]
        if (defaultContent.trim()) {
            const cleanContent = this.extractConfig(defaultContent, scenario, Scenario.defaultAct)
            text = text.replace(defaultContent, cleanContent)
        }

        text
            .split(BLOCK_SPLITTER_REGEXP)
            .forEach(textBlock => {
                const [head, ...body] = textBlock.split(LINE_SPLITTER_REGEXP)

                // extract new act
                if (/\[.*]/.test(head)) {
                    act = head.replace(ACT_REGEXP, '') || Scenario.defaultAct
                    if (act.startsWith(this.config.comment)) return null
                    
                    const description = body
                        .filter(line => !line.startsWith(this.config.comment))
                        .join('\n')

                    this.extractConfig(description, scenario, act)
                    return null
                }
                
                // skip commented blocks and acts
                if (head.startsWith(this.config.comment) || act.startsWith(this.config.comment)) {
                    return null
                }

                // prepare scenario for a new act
                this.#checkCreateAct(scenario, act)

                // store message
                const role = head.replace(/:\s*$/, '').trim()
                
                const content = body
                    .filter(line => !line.startsWith(this.config.comment))
                    .join(this.config.join ?? ' ')
                    .replace(/\\\s+/g, '\n')
                    .replace(/\{(\w+)}/g, (_, name) => (this.#storePlaceholder(scenario, act, name), _))
                
                scenario[act].push({
                    [this.config.roleKey || 'role']: role,
                    [this.config.contentKey || 'content']: content
                })
            })

        return scenario
    }

    extractConfig(text, scenario, act) {
        return text.replace(DIRECTIVE_REGEXP, (_, directive) => {
            // change the processor behavior
            if (directive.startsWith('use ')) {
                const [use, key, ...values] = directive.split(/\s+/)
                const value = values.join(' ').trim()
                this.config[key.trim()] = Scenario.directiveValues[value] ?? tryNumber(value)
                return ''
            }
            
            // store user settings
            if (/=/.test(directive)) {
                const key = directive.slice(0, directive.indexOf('=')).trim()
                const value = directive.slice(directive.indexOf('=') + 1).trim()
                this.#storeConfig(scenario, act, key, tryArray(value))
                return ''
            }
            
            // store directives
            if (/^\w+$/.test(directive)) {
                this.#storeConfig(scenario, act, directive, true)
                return ''
            }
            
            return ''
        })
    }

    build(context = this.context, act = Scenario.defaultAct) {
        return this.scenario[act]?.map(message => ({
            role: message.role,
            content: message.content.replace(/\{(\w+)}/g, (_, key) => context[key] ?? '???')
        })) ?? []
    }
    
    execute(context, act = Scenario.defaultAct) {
        Object.assign(this.context, context)
        const messages = this.build(this.context, act)
            .map(message => {
                const action = this.config.actions?.[message.role]
                if (typeof action === 'function') return action(message.content, act, this.scenario, this)
                return action ?? message
            })
            .filter(Boolean)
        this.history.push(...messages)
        return messages
    }
    
    start(context) {
        this.clear()
        
        let index = 0
        if (Number.isInteger(context)) {
            index = context
            context = null
        } else if (typeof context === 'string') {
            index = this.scenario[Scenario.orderSymbol].indexOf(context)
            context = null
        }
        
        this.queue = this.scenario[Scenario.orderSymbol].slice(index)
        
        if (!context) return this

        this.act = this.queue.shift()
        return this.execute(context, this.act)
    }
    
    get placeholders() {
        return this.scenario[this.act]?.[Scenario.placeholderSymbol] ?? []
    }
    
    get actConfig() {
        return this.scenario[this.act]?.[Scenario.configSymbol]
            ?? this.scenario[Scenario.defaultAct]?.[Scenario.configSymbol]
            ?? this.config
    }
    
    next(context, returnHistory = false) {
        this.act = this.queue.shift() ?? null
        if (!this.act) return null
        
        const messages = this.execute(context, this.act)
        return returnHistory ? this.history : messages
    }
    
    get hasNext() {
        return this.queue[0] ?? null
    }
    
    get nextPlaceholders() {
        return this.scenario[this.queue[0]]?.[Scenario.placeholderSymbol] ?? []
    }
    
    get nextConfig() {
        return this.scenario[this.queue[0]]?.[Scenario.configSymbol] ?? {}
    }
    
    answer(message) {
        this.history.push(message)
    }
    
    end() {
        this.act = null
        this.queue = []
        return this.history
    }
    
    clear() {
        this.history = []
        this.act = null
        this.queue = []
        this.context = {}
    }

    readHistory(skipRoles = []) {
        if (!Array.isArray(skipRoles)) skipRoles = [skipRoles]
        const roleKey = this.config.roleKey || 'role'
        const contentKey = this.config.contentKey || 'content'

        return this.history
            .filter(message => !skipRoles.includes(message[roleKey]))
            .map(message => `${message[roleKey]}:\n\t${message[contentKey].replace(/\n/g, '\n\t')}`)
            .join('\n\n')
    }

    #checkCreateAct = (scenario, act) => {
        if (!scenario[act]) {
            scenario[act] = []
            scenario[act][Scenario.placeholderSymbol] = []
            
            const proto = scenario[Scenario.defaultAct]?.[Scenario.configSymbol] ?? this.config
            scenario[act][Scenario.configSymbol] = Object.create(proto)

            scenario[Scenario.orderSymbol].push(act)
        }
    }
    
    #storePlaceholder = (scenario, act, name) => {
        this.#checkCreateAct(scenario, act)
        if (!scenario[act][Scenario.placeholderSymbol].includes(name)) {
            scenario[act][Scenario.placeholderSymbol].push(name)
        }
    }
    
    #storeConfig = (scenario, act, key, value) => {
        this.#checkCreateAct(scenario, act)
        scenario[act][Scenario.configSymbol][key] = value
    }
}
