import { WechatyBuilder } from 'wechaty';
import qrcodeTerminal from 'qrcode-terminal';
import { ChatGPTClient } from '@waylaidwanderer/chatgpt-api';

const config = {
  // 填入你的OPENAI_API_KEY
  OPENAI_API_KEY: "fk-nUgwWlYLaVT40e2KdsDveiwj9X-AaxvlU1ecBlylRPU",
  // 反向代理地址，简单说就是你的在国外服务器地址，如何获取看README
  // 可换成你自己的，白嫖代理地址 https://ai.devtool.tech/proxy/v1/chat/completions
  reverseProxyUrl: "https://ai.fakeopen.com/v1/chat/completions",
  // 在群组中设置唤醒微信机器人的关键词
  groupKey: "",
  // 在私聊中设置唤醒微信机器人的关键词
  privateKey: "",
  // 重置上下文的关键词，如可设置为reset
  resetKey: "reset",
  // 是否在群聊中带上提问的问题
  groupReplyMode: true,
  // 是否在私聊中带上提问的问题
  privateReplyMode: false
};

const clientOptions = {
  // (Optional) Support for a reverse proxy for the completions endpoint (private API server).
  // Warning: This will expose your `openaiApiKey` to a third party. Consider the risks before using this.
  // reverseProxyUrl: "",
  // (Optional) Parameters as described in https://platform.openai.com/docs/api-reference/completions
  modelOptions: {
    // You can override the model name and any other parameters here, like so:
    model: "gpt-3.5-turbo",
    // I'm overriding the temperature to 0 here for demonstration purposes, but you shouldn't need to override this
    // for normal usage.
    temperature: 0
    // Set max_tokens here to override the default max_tokens of 1000 for the completion.
    // max_tokens: 1000,
  },
  // (Optional) Davinci models have a max context length of 4097 tokens, but you may need to change this for other models.
  // maxContextTokens: 4097,
  // (Optional) You might want to lower this to save money if using a paid model like `text-davinci-003`.
  // Earlier messages will be dropped until the prompt is within the limit.
  // maxPromptTokens: 3097,
  // (Optional) Set custom instructions instead of "You are ChatGPT...".
  // promptPrefix: 'You are Bob, a cowboy in Western times...',
  // (Optional) Set a custom name for the user
  // userLabel: 'User',
  // (Optional) Set a custom name for ChatGPT
  // chatGptLabel: 'ChatGPT',
  // (Optional) Set to true to enable `console.debug()` logging
  debug: false
};
const cacheOptions = {
  // Options for the Keyv cache, see https://www.npmjs.com/package/keyv
  // This is used for storing conversations, and supports additional drivers (conversations are stored in memory by default)
  // For example, to use a JSON file (`npm i keyv-file`) as a database:
  // store: new KeyvFile({ filename: 'cache.json' }),
};
class ChatGPT {
  constructor() {
    this.chatGPT = new ChatGPTClient(
      config.OPENAI_API_KEY,
      {
        ...clientOptions,
        reverseProxyUrl: config.reverseProxyUrl
      },
      cacheOptions
    );
    this.chatOption = {};
  }
  async test() {
    const response = await this.chatGPT.sendMessage("hello");
    console.log("response test: ", response);
  }
  async getChatGPTReply(content, contactId) {
    const data = await this.chatGPT.sendMessage(
      content,
      this.chatOption[contactId]
    );
    const { response, conversationId, messageId } = data;
    this.chatOption = {
      [contactId]: {
        conversationId,
        parentMessageId: messageId
      }
    };
    console.log("response: ", response);
    return response;
  }
  async replyMessage(contact, content) {
    const { id: contactId } = contact;
    try {
      if (content.trim().toLocaleLowerCase() === config.resetKey.toLocaleLowerCase()) {
        this.chatOption = {
          ...this.chatOption,
          [contactId]: {}
        };
        await contact.say("\u5BF9\u8BDD\u5DF2\u88AB\u91CD\u7F6E");
        return;
      }
      const message = await this.getChatGPTReply(content, contactId);
      if (contact.topic && contact?.topic() && config.groupReplyMode || !contact.topic && config.privateReplyMode) {
        const result = content + "\n-----------\n" + message;
        await contact.say(result);
        return;
      } else {
        await contact.say(message);
      }
    } catch (e) {
      console.error(e);
      if (e.message.includes("timed out")) {
        await contact.say(
          content + "\n-----------\nERROR: Please try again, ChatGPT timed out for waiting response."
        );
      }
    }
  }
}

let bot = {};
const startTime = /* @__PURE__ */ new Date();
let chatGPTClient = null;
initProject();
async function onMessage(msg) {
  if (msg.date() < startTime) {
    return;
  }
  const contact = msg.talker();
  const receiver = msg.to();
  const content = msg.text().trim();
  const room = msg.room();
  const alias = await contact.alias() || await contact.name();
  const isText = msg.type() === bot.Message.Type.Text;
  if (msg.self()) {
    return;
  }
  if (room && isText) {
    const topic = await room.topic();
    console.log(
      `Group name: ${topic} talker: ${await contact.name()} content: ${content}`
    );
    const pattern = RegExp(`^@${receiver.name()}\\s+${config.groupKey}[\\s]*`);
    if (await msg.mentionSelf()) {
      if (pattern.test(content)) {
        const groupContent = content.replace(pattern, "");
        chatGPTClient.replyMessage(room, groupContent);
        return;
      } else {
        console.log(
          "Content is not within the scope of the customizition format"
        );
      }
    }
  } else if (isText) {
    console.log(`talker: ${alias} content: ${content}`);
    if (content.startsWith(config.privateKey) || config.privateKey === "") {
      let privateContent = content;
      {
        privateContent = content.substring(config.privateKey.length).trim();
      }
      chatGPTClient.replyMessage(contact, privateContent);
    } else {
      console.log(
        "Content is not within the scope of the customizition format"
      );
    }
  }
}
function onScan(qrcode) {
  qrcodeTerminal.generate(qrcode, { small: true });
  const qrcodeImageUrl = [
    "https://api.qrserver.com/v1/create-qr-code/?data=",
    encodeURIComponent(qrcode)
  ].join("");
  console.log(qrcodeImageUrl);
}
async function onLogin(user) {
  console.log(`${user} has logged in`);
  const date = /* @__PURE__ */ new Date();
  console.log(`Current time:${date}`);
}
function onLogout(user) {
  console.log(`${user} has logged out`);
}
async function initProject() {
  try {
    chatGPTClient = new ChatGPT();
    bot = WechatyBuilder.build({
      name: "WechatEveryDay",
      puppet: "wechaty-puppet-wechat",
      // 如果有token，记得更换对应的puppet
      puppetOptions: {
        uos: true
      }
    });
    bot.on("scan", onScan).on("login", onLogin).on("logout", onLogout).on("message", onMessage);
    bot.start().then(() => console.log("Start to log in wechat...")).catch((e) => console.error(e));
  } catch (error) {
    console.log("init error: ", error);
  }
}
