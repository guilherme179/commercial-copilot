import { GenerateSQLInput } from './dto/generate-sql.dto';
import { InterpreterDao } from './interpreter.dao';
import { Injectable } from '@nestjs/common';

@Injectable()
export class InterpreterService {
    private schema!: string;
    private readonly baseUrl = process.env.LLM_BASE_URL;
    private readonly model = process.env.LLM_MODEL;

    constructor(private readonly interpreterDao: InterpreterDao) {}

    // executa uma única vez quando o módulo inicializa
    async onModuleInit(): Promise<void> {
        this.schema = await this.interpreterDao.getSchema([
            'employees',           // gerente de carteira
            'customers',           // clientes da carteira
            'orders',              // pedidos
            'order_details',       // itens de cada pedido
            'order_details_status',// status dos itens
            'orders_status',       // status dos pedidos
            'products',            // produtos
            'invoices',            // faturas / financeiro
            'shippers',            // transportadoras
        ]);
    }

    private sanitizeSQL(sql: string): string {
        return sql
            .replace(/```sql/gi, '')  // remove ```sql
            .replace(/```/g, '')       // remove ``` restante
            .trim();
    }        

    async generateSQL(input: GenerateSQLInput): Promise<string> {
        const { question, employeeId } = input;
        const prompt = `
            You are an assistant that generates MySQL queries.

            Database schema:
            ${this.schema}

            Rules:
            - Return ONLY the SQL query, no explanation, no markdown
            - Always use LIMIT 100
            - Never use DROP, DELETE, UPDATE, INSERT, TRUNCATE, ALTER
        `;

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: this.model,
                messages: [{ role: 'system', content: prompt }, { role: 'user', content: `EmployeeId: ${employeeId}\nQuestion: ${question}` }],
                temperature: 0.1,
                stream: false,
            }),
        });

        const data = await response.json();
        return this.sanitizeSQL(data.choices[0].message.content);
    }
}
