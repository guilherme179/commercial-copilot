import z from "zod";

const QuestionSchema = z.object({
  question: z.string().min(1),
  employeeId: z.string().min(1),
});

export type QuestionDto = z.infer<typeof QuestionSchema>;

export class QuestionZodDto {
  static schema = QuestionSchema;
}