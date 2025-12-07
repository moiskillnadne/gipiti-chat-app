// import { experimental_generateImage as generateImage } from "ai";
// import { createDocumentHandler } from "@/lib/artifacts/server";

// export const imageDocumentHandler = createDocumentHandler<"image">({
//   kind: "image",
//   onCreateDocument: async ({ title, dataStream }) => {
//     const { image } = await generateImage({
//       model: getImageModel(),
//       prompt: title,
//       size: "1024x1024",
//       providerOptions: {
//         openai: { style: "vivid" },
//       },
//     });

//     dataStream.write({
//       type: "data-imageDelta",
//       data: image.base64,
//       transient: true,
//     });

//     return image.base64;
//   },
//   onUpdateDocument: async ({ description, dataStream }) => {
//     const { image } = await generateImage({
//       model: getImageModel(),
//       prompt: description,
//       size: "1024x1024",
//       providerOptions: {
//         openai: { style: "vivid" },
//       },
//     });

//     dataStream.write({
//       type: "data-imageDelta",
//       data: image.base64,
//       transient: true,
//     });

//     return image.base64;
//   },
// });
