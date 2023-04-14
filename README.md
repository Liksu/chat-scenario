# Chat Scenario Processor

Chat Scenario Processor will help you to create interactive conversations based on predefined scenarios.
It's perfect for chatbots, text-based games, or any project that involves sequential, role-based conversations.
Especially for OpenAI Chat API.

## Features

- Define scenarios with multiple acts and roles
- Easily manage conversation flow with a simple API
- Replace placeholders with dynamic context data
- Built-in support for comments and act descriptions

## Installation

Install the package using npm:

```bash
npm install history-scenario
```

## Usage Example

### The Idea

Let's create a scenario for a small dialog between user and openAI chat assistant.

In this case we should define parts of the conversation, it will be Acts.\
The first act will be the context and greetings,
the second will be user's name,
the third for the first user choice,
and the last will be the second user choice.
And the answer of assistant will close the dialog.\
Each act means the part of the conversation that will be passed to the assistant.

Also, we can use the `'system'` role to define context and the `'user'` role to pass the user's input.

Also, let's assume, that we have the async input mechanism that is not a part of this example.
We just need to create a middleware between the user and the assistant.\
Let's suppose that we have `input()` and `output()` functions to communicate with the user, and `openAIChatAssistant()` to communicate with the assistant.

### Implementation

Import the Scenario class:

```javascript
import Scenario from 'chat-scenario'
```

Create a scenario text file, specifying roles, acts, and messages. Use placeholders to insert dynamic content:

```plaintext
system:
    define constants:\
    COLORS = RED,GREEN,BLUE\
    RED+GREEN = strawberry\
    RED+BLUE = sea sunset\
    GREEN+BLUE = forest

system:
    Rules:\
    You greets the user by name and propose to choose a color from COLORS.
    Then, you take random color from COLORS and tell user the both colors and the result of their mix from GRB palette.

system:
    Let's start the conversation, ask user for his name.

[Greetings]

user:
    Hi, my name is {name}
    
system:
    Now, ask user to choose a color from COLORS.

[Color choice]

user:
    I choose {color}

[Area choice]

system:
    Now ask user to choose an area of imagination.

[Final]

system:
    Now taking both colors, find in constants the result of their combination
    and describe the picture based on it.

user:
    Let it be something from {area} area
```

Initialize the Scenario class with this text, and ask assistant for the first prompt:

```javascript
const chatScenario = new Scenario(scenarioText)
const startMessages = chatScenario.start()
```

Now the `startMessages` contains the first act of the conversation, as an array of messages:

```javascript
[
    {
        role: 'system',
        content: 'define constants:\nCOLORS=RED,GREEN,BLUE\nRED+GREEN=strawberry\nRED+BLUE=sea sunset\nGREEN+BLUE=forest'
    },
    {
        role: 'system',
        content: 'Rules:\nYou greets the user by name and propose to choose a color from COLORS. Then, you take random color from COLORS and tell user the both colors and the result of their from GRB palette.'
    },
    {
        role: 'user',
        content: 'Hi, my name is John'
    },
]
```

Then, we can pass this messages to the assistant and get the response:

```javascript
// get the response from the assistant
const namePrompt = await openAIChatAssistant(startMessages)

// store the response in the scenario
chatScenario.answer(namePrompt)

// show it to the user
output(namePrompt.content)
```

Let the `namePrompt` to be something like this:

```json
{
    "role": "assistant",
    "content": "Hello! What is your name?"
}
```

Get the user input and continue the scenario for the "Greetings" act:

```javascript
const name = await input()

let history = chatScenario.next({name}, true)
```

To keep the context, we need to provide the assistant with the whole conversation,
so here we use the `true` flag to get the full `chatScenario.history` instead of only act's messages.

Now, the history contains new messages:

```javascript
[
    ...startMessages,
    {
        role: 'assistant',
        content: 'Hello! What is your name?'
    },
    {
        role: 'user',
        content: 'Hi, my name is John'
    },
    {
        role: 'system',
        content: 'Now, ask user to choose a color from COLORS'
    }
]
```

And again, we'll send this history to the assistant and get the response. And so on...

```javascript
// get the response from the assistant
const colorPrompt = await openAIChatAssistant(history)

// store the response in the scenario
chatScenario.answer(colorPrompt)

// show it to the user
output(colorPrompt.content)

// get the user input
const color = await input()

// continue the scenario for the "Color choice" act
history = chatScenario.next({color}, true)

// get the response from the assistant and show it to the user
const colorAnswer = await openAIChatAssistant(history)
chatScenario.answer(colorAnswer)
output(colorAnswer.content)

// proceed to the next "Area choice" act
history = chatScenario.next({}, true)
const areaPrompt = await openAIChatAssistant(history)
chatScenario.answer(areaPrompt)
output(areaPrompt.content)

// get the user input for the area and finalize the scenario
const area = await input()
history = chatScenario.next({area}, true)
const finalAnswer = await openAIChatAssistant(history)
chatScenario.answer(finalAnswer)
output(finalAnswer.content)

// optional, end the scenario
chatScenario.end()
```

You can loop iterations over the scenario, until the `chatScenario.next()` returns `null`.

### The Result

After the scenario is finished, you can get the full conversation history:

```javascript
const history = chatScenario.history

// that will contains:
history === [
    
]
```
