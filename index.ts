import { OpenRouter } from '@openrouter/sdk'; 
import { responseOutputTextFromJSON, toolCallFromJSON, type InputsUnion1, type OpenAIResponsesRefusalContent, type OpenResponsesResult, type OutputFunctionCallItem, type OutputMessageItem, type OutputReasoningItem, type ResponseOutputText, type ResponsesRequestToolFunction } from '@openrouter/sdk/models';

/*
  1. SETUP
  Create the OpenRouter client 
*/

/*
  2. FIRST REQUEST
  Send the user's question plus the tools list to the model . It replies with a `function_call` item
  asking us to run get_weather. We save its output into `inputs` (via
  convertOutputItemToInput, which validates and converts output items into
  valid input items) and throw if no tool call came back.
*/

/*
  3. RUN THE TOOL
  call each  toolcall 
   check the name is `get_weather`, parse the JSON   `arguments` to get the city, run `weatherExecute(city)`, and append a
  `function_call_output` to `inputs`. It is linked to the request by `callId`.
*/

/*
  4. SECOND REQUEST
  Resend the full history (user message + model's tool call + tool result),
  since the API is stateless. Check that the status is `completed`, then find
  the `message` item in the output and print its `output_text`. This is the
  final answer.
*/

const weatherExecute = (city : string) => {

  switch (city.toLowerCase()) {
    case 'gurgaon':
      return `${city} : 25`
    case 'delhi':
      return `${city} : 28`
    default:
      throw new Error(`Weather data not available for ${city}`);
  }
};


const tools: ResponsesRequestToolFunction[] = [    
{
    type: 'function',
    name: 'get_weather',
    description: 'Get current weather for a city',
    parameters: {
        type: 'object',
        properties: { 
            city: { 
                type: 'string' ,
                description: 'The name of the city to get the weather for'
            } 
        },
        required: ['city']
    }
}
]




function convertOutputItemToInput(
  item: OpenResponsesResult['output'][number],
): InputsUnion1 {
  if (isOutputMessageItem(item)) {
    const content = item.content.filter(isKnownMessageContent);
    if (content.length !== item.content.length) {
      throw new Error('Received an unsupported message content type');
    }
    return { ...item, content };
  }
 
  if (isFunctionCallOrReasoningItem(item)) {
    return item;
  }
 
  throw new Error(`Received an unexpected output item: ${item.type}`);
}
 
function isOutputMessageItem(
  item: OpenResponsesResult['output'][number],
): item is OutputMessageItem {
  return item.type === 'message';
}
 
function isKnownMessageContent(
  content: OutputMessageItem['content'][number],
): content is OpenAIResponsesRefusalContent | ResponseOutputText {
  return content.type === 'output_text' || content.type === 'refusal';
}
 
function isFunctionCallOrReasoningItem(
  item: OpenResponsesResult['output'][number],
): item is OutputFunctionCallItem | OutputReasoningItem {
  return item.type === 'function_call' || item.type === 'reasoning';
}

 
const inputs: InputsUnion1[] = [{
  content: "What is the weather in gurgaon and delhi",
  role: "user"
}]
 


console.log("tools value before sending request first time: ", tools);

const client = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const response = await client.responses.send({
  responsesRequest: {
    model: process.env.OPENROUTER_MODEL,
    input: inputs,
    stream: false,
    tools
    }
  }
);



inputs.push(...response.output.map((item) => convertOutputItemToInput(item)));

const toolcalls = response.output.filter(x => x.type === "function_call")
//console.log("toolcalls by LLM : ", toolcalls);

if (toolcalls.length === 0) {  
    throw new Error('Weather tool call not found in the response');
}



for (const toolCall of toolcalls) {

        if (toolCall.name != 'get_weather') {
        throw new Error('Weather tool call not found in the response');
        }

        const city = JSON.parse(toolCall.arguments).city;
        if (toolCall.name !== 'get_weather') {
        throw new Error('Weather tool call not found in the response');
        }

        const weatherResult = weatherExecute(city);
        inputs.push({
            type: 'function_call_output',   
            callId: toolCall.callId,
            output: weatherResult.toString(),
            
        });
}



console.log("response2 input : ", inputs );


const response2 = await client.responses.send({
  responsesRequest: {
    model: process.env.OPENROUTER_MODEL,
    input: inputs,
    stream: false
    }
  }
);

console.log("response2 by LLM : ", response2.toString() );

if (response2.status !== 'completed') {
  throw new Error(response2.error?.message ?? `Response ended as ${response2.status}`);
}

const message = response2.output.find((item) => item.type === 'message');
console.log(message?.content.find((part) => part.type === 'output_text')?.text);
