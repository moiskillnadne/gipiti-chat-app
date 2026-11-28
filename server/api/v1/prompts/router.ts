import { toPromptDto } from "@/server/api/v1/_mappers/prompt";
import { v1 } from "@/server/api/v1/implementer";
import { getActivePrompts } from "@/server/modules/prompts/queries/get-active-prompts";

export const promptsRouter = {
  // No `withPrincipal`: the catalogue is the same for everyone, and a request
  // with a bad token must not be refused for a credential nobody needs.
  list: v1.prompts.list.handler(async () => {
    const prompts = await getActivePrompts();

    return { items: prompts.map(toPromptDto) };
  }),
};
