import { OpenRouter } from '@openrouter/sdk';
import {
  responseOutputTextFromJSON,
  toolCallFromJSON,
  type InputsUnion1,
  type OpenAIResponsesRefusalContent,
  type OpenResponsesResult,
  type OutputFunctionCallItem,
  type OutputMessageItem,
  type OutputReasoningItem,
  type ResponseOutputText,
  type ResponsesRequestToolFunction
} from '@openrouter/sdk/models';

/*
  1. SETUP :   Create the OpenRouter client 
  2. FIRST REQUEST :    Send the user's question plus the tools list to the model . It replies with a `function_call` item. We save its output into `inputs` (via
      convertOutputItemToInput, which validates and converts output items into   valid input items) and throw if no tool call came back. 
  3. RUN THE TOOL  :    call each  toolcall 
      check the name is `get_weather`, parse the JSON   `arguments`  and append a   `function_call_output` to `inputs`. It is linked to the request by `callId`.
  4. LOOP :   Go back to step 2 until the model returns a message instead of a tool call.
*/



const bashExecute = async (command: string) => {
  console.log("running command " + command);
  try {
    const result = await Bun.$`bash -lc ${command}`
      .cwd(__dirname)
    const stdout = result.stdout.toString();

    return {
      stdout
    };
  } catch(e) {
    return {
      stdout: "",
      stderr: "Error while running command"
    }
  }
}


const tools: ResponsesRequestToolFunction[] = [
  {
    type: "function",
    name: "bash",
    description: "Runs a bash command",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The bash command to run"
        }
      },
      required: ["command"]
    }
  }
]




function convertOutputItemToInput(   item: OpenResponsesResult['output'][number] ): InputsUnion1 {
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

function isOutputMessageItem(   item: OpenResponsesResult['output'][number] ): item is OutputMessageItem {
  return item.type === 'message';
}

function isKnownMessageContent(   content: OutputMessageItem['content'][number], ): content is OpenAIResponsesRefusalContent | ResponseOutputText {
  return content.type === 'output_text' || content.type === 'refusal';
}

function isFunctionCallOrReasoningItem(   item: OpenResponsesResult['output'][number], ): item is OutputFunctionCallItem | OutputReasoningItem {
  return item.type === 'function_call' || item.type === 'reasoning';
}


const inputs: InputsUnion1[] = [{
  content: "Explore this repo to tell me what it does , dont read .env file or any other hidden files , ignore indexv** files,also ignore any files with harkirat_sir in the name ",
  role: "user"
}]

const client = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,

});





console.log("tools first time : ", tools);

while (true) {

  const response = await client.responses.send({
    responsesRequest: {
      model: process.env.OPENROUTER_MODEL,
      input: inputs,
      stream: false,
      tools
    }
  });

  inputs.push(...response.output.map((item) => convertOutputItemToInput(item)));
  const toolcalls = response.output.filter(x => x.type === "function_call")
  //console.log("toolcalls by LLM : ", toolcalls);

  if (toolcalls.length === 0) {

    const message = response.output.find((item) => item.type === 'message');
    console.log(message?.content.find((part) => part.type === 'output_text')?.text);

    if (response.status !== 'completed') {
    throw new Error(`Response ended as ${response.status}`);
  }

    break;
  }



  for (const toolCall of toolcalls) {

    if (toolCall.name != 'bash') {
      throw new Error('Bash tool call not found in the response');
    }

    const command = JSON.parse(toolCall.arguments).command;
    const bashResult = await bashExecute(command);
    inputs.push({
      type: 'function_call_output',
      callId: toolCall.callId,
      output: JSON.stringify(bashResult),
    });
  }
}