const COMA_REGEXP = /,(?=(?:[^"]|"[^"]*")*$)/
const DIRECTIVE_REGEXP = /^%\s*(.*)\s*\n/gm;
const BLOCK_SPLITTER_REGEXP = /(?:\s*\n\s*){2,}/m;
const LINE_SPLITTER_REGEXP = /\s*\n\s*/m;
const ACT_REGEXP = /^\s*\[\s*|\s*]\s*$/g;

export default class Scenario {
    static orderSymbol = Symbol('order')
    static placeholderSymbol = Symbol('placeholder')
    static defaultAct = 'default'

    static directiveValues = {
        'true': true,
        'false': false,
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

        const storePlaceholder = (act, name) => {
            if (!scenario[act][Scenario.placeholderSymbol]) scenario[act][Scenario.placeholderSymbol] = []
            if (!scenario[act][Scenario.placeholderSymbol].includes(name)) {
                scenario[act][Scenario.placeholderSymbol].push(name)
            }
        }
        
        this.extractConfig(text)
            .split(BLOCK_SPLITTER_REGEXP)
            .forEach(textBlock => {
                const [head, ...body] = textBlock.split(LINE_SPLITTER_REGEXP)

                // extract new act
                if (/\[.*]/.test(head)) {
                    act = head.replace(ACT_REGEXP, '') || Scenario.defaultAct
                    return null
                }
                
                // skip commented blocks and acts
                if (head.startsWith(this.config.comment) || act.startsWith(this.config.comment)) {
                    return null
                }

                // prepare scenario for a new act
                if (!scenario[act]) {
                    scenario[act] = []
                    scenario[Scenario.orderSymbol].push(act)
                }

                // store message
                const role = head.replace(/:\s*$/, '').trim()
                
                const content = body
                    .filter(line => !line.startsWith(this.config.comment))
                    .join(this.config.join ?? ' ')
                    .replace(/\\\s+/g, '\n')
                    .replace(/\{(\w+)}/g, (_, name) => (storePlaceholder(act, name), _))
                
                scenario[act].push({
                    [this.config.roleKey || 'role']: role,
                    [this.config.contentKey || 'content']: content
                })
            })

        return scenario
    }

    //TODO: extract for each act separately and combine with default on each execution
    extractConfig(text) {
        return text.replace(DIRECTIVE_REGEXP, (_, directive) => {
            // change the processor behavior
            if (directive.startsWith('use ')) {
                const [use, key, ...values] = directive.split(/\s+/)
                const value = values.join(' ').trim()
                this.config[key.trim()] = Scenario.directiveValues[value] ?? (!isNaN(value) && !isNaN(parseFloat(value)) ? parseFloat(value) : value)
                return ''
            }
            
            // store user settings
            if (/=/.test(directive)) {
                const key = directive.slice(0, directive.indexOf('=')).trim()
                const value = directive.slice(directive.indexOf('=') + 1).trim()
                this.config[key] = COMA_REGEXP.test(value) ? value.split(COMA_REGEXP).map(item => item.trim()) : value
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
}
