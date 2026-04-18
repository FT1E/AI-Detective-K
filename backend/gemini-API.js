import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI("API_KEY");

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

async function run() {
  const prompt = "You are an AI detective. Analyze this case.";

  const result = await model.generateContent(prompt);

  console.log(result.response.text());
}

run();
