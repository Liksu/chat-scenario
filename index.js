export default class Scenario {
    static orderSymbol = Symbol('order')
    static defaultAct = 'default'
    
    scenario = {}
    placeholders = {}
    
    history = []
    act = null
    context = {}
    queue = []

    constructor(text) {
        [this.scenario, this.placeholders] = this.prepare(text)
    }

    prepare(text) {
        const scenario = {
            [Scenario.orderSymbol]: [],
        }
        let act = Scenario.defaultAct

        const placeholders = {}
        const storePlaceholder = (act, name) => {
            if (!placeholders[act]) placeholders[act] = []
            if (!placeholders[act].includes(name)) {
                placeholders[act].push(name)
            }
        }
        
        text
            .replace(/\r/g, '')
            .split(/(?:\s*\n\s*){2,}/m)
            .forEach(textBlock => {
                const [role, ...content] = textBlock.split(/\s*\n\s*/m)

                // extract new act
                if (/\[.*]/.test(role)) {
                    act = role.replace(/^\s*\[\s*|\s*]\s*$/g, '') || Scenario.defaultAct
                    return null
                }
                
                // skip commented blocks and acts
                if (role.startsWith('#') || act.startsWith('#')) {
                    return null
                }

                // prepare scenario for a new act
                if (!scenario[act]) {
                    scenario[act] = []
                    scenario[Scenario.orderSymbol].push(act)
                }

                // store message
                scenario[act].push({
                    role: role.replace(/:\s*$/, '').trim(),
                    content: content
                        .filter(line => !line.startsWith('#'))
                        .join(' ')
                        .replace(/\\\s+/g, '\n')
                        .replace(/\{(\w+)}/g, (_, name) => (storePlaceholder(act, name), _))
                })
            })

        return [scenario, placeholders]
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
    
    next(context, returnHistory = false) {
        this.act = this.queue.shift() ?? null
        if (!this.act) return null
        
        const messages = this.execute(context, this.act)
        return returnHistory ? this.history : messages
    }
    
    get hasNext() {
        return this.queue.length > 0
    }
    
    get nextPlaceholders() {
        return  this.placeholders[this.queue[0]] ?? []
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
