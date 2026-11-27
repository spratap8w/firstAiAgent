import { OpenRouter } from '@openrouter/sdk'; 
import { responseOutputTextFromJSON, toolCallFromJSON, type InputsUnion1, type OpenAIResponsesRefusalContent, type OpenResponsesResult, type OutputFunctionCallItem, type OutputMessageItem, type OutputReasoningItem, type ResponseOutputText, type ResponsesRequestToolFunction } from '@openrouter/sdk/models';


// 1. Give it access to a weather tool (2 step request) (15 minutes)
// 2. Give it access to the bash tool (2 step request)
// 3. Write the agent loop
 
/// 1. streaming, 2. web_search, 3. create_sub_agent (depth - 4)
/// cintext eng





const weatherExecute = (city : string) => {
    return 25;
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


 
 
const inputs: InputsUnion1[] = [{
  content: "What is the weather in gurgaon",
  role: "user"
}]
 



const client = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const response = await client.responses.send({
  responsesRequest: {
    model: 'baidu/ernie-5.5-flash-preview:free',
    input: 'What is the weather in gurgaon ',
    stream: false,
    tools
    }
  }
);


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
    model: 'baidu/ernie-5.5-flash-preview:free',
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

