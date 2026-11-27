import { OpenRouter } from '@openrouter/sdk'; 
import { responseOutputTextFromJSON, toolCallFromJSON, type InputsUnion1, type OpenAIResponsesRefusalContent, type OpenResponsesResult, type OutputFunctionCallItem, type OutputMessageItem, type OutputReasoningItem, type ResponseOutputText, type ResponsesRequestToolFunction } from '@openrouter/sdk/models';


const weatherExecute = (city : string) => {

  switch (city.toLowerCase()) {
    case 'gurgaon':
      return `${city} : 25`
    case 'delhi':
      return `${city} : 28`
    default:
      return `${city} : 30` 
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
  content: "What is the weather in gurgaon and delhi and make weather calls sequentially",
  role: "user"
}]
 


console.log("tools value before sending request first time: ", tools);

const client = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});


while (true) {

const response = await client.responses.send({
  responsesRequest: {
    model: process.env.OPENROUTER_MODEL,
    input: inputs,
    stream: false,
    tools
    }
  }
);

console.log("response by LLM : ", JSON.stringify(response.output, null, 2));
const toolcalls = response.output.filter(x => x.type === "function_call")

if (toolcalls.length === 0){
    
  if (!('output' in response)) {
      throw new Error('Expected a non-streaming response');
    }

const finalMessage = [...response.output].reverse().find((item) => item.type === 'message');
console.log(finalMessage?.content.find((part) => part.type === 'output_text')?.text);
break;
}

inputs.push(...response.output.map((item) => convertOutputItemToInput(item)));
for (const toolCall of toolcalls) {

    if (toolCall.name != 'get_weather') {
    throw new Error('Weather tool call not found in the response');
    }

    const city = JSON.parse(toolCall.arguments).city;        
    const weatherResult = weatherExecute(city);
    inputs.push({
        type: 'function_call_output',   
        callId: toolCall.callId,
        output: weatherResult.toString(),
        
    });
}
}