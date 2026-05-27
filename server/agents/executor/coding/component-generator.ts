import { fileHeader, toPascalCase, toKebabCase } from '../utils/code-utils.ts';
import { generateCrudComponent } from '../templates/crud-template.ts';

export interface GeneratedFile {
  relativePath: string;
  content:      string;
}

export const componentGenerator = {
  generateReactComponent(name: string, props: string[] = []): GeneratedFile {
    const pascal     = toPascalCase(name);
    const propsBlock = props.length > 0
      ? `interface ${pascal}Props {\n${props.map((p) => `  ${p}: string;`).join('\n')}\n}\n\n`
      : '';
    const propsArg = props.length > 0 ? `{ ${props.join(', ')} }: ${pascal}Props` : '';

    return {
      relativePath: `src/components/${pascal}.tsx`,
      content:      `${fileHeader(`${pascal} component`)}${propsBlock}export function ${pascal}(${propsArg}) {\n  return (\n    <div className="rounded-lg border bg-card p-4 shadow-sm">\n      <h3 className="font-medium text-card-foreground">${pascal}</h3>\n    </div>\n  );\n}\n`,
    };
  },

  generateFormComponent(resourceName: string): GeneratedFile {
    const pascal = toPascalCase(resourceName);
    const kebab  = toKebabCase(resourceName);

    return {
      relativePath: `src/components/${pascal}Form.tsx`,
      content:      `${fileHeader(`${pascal} form component`)}import { useForm } from 'react-hook-form';\nimport { Button } from '@/components/ui/button';\nimport { Input } from '@/components/ui/input';\nimport { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';\n\ninterface ${pascal}FormValues {\n  name: string;\n}\n\ninterface ${pascal}FormProps {\n  onSubmit: (values: ${pascal}FormValues) => void;\n  isLoading?: boolean;\n}\n\nexport function ${pascal}Form({ onSubmit, isLoading }: ${pascal}FormProps) {\n  const form = useForm<${pascal}FormValues>({ defaultValues: { name: '' } });\n\n  return (\n    <Form {...form}>\n      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">\n        <FormField control={form.control} name="name" render={({ field }) => (\n          <FormItem>\n            <FormLabel>Name</FormLabel>\n            <FormControl><Input placeholder="${pascal} name" {...field} /></FormControl>\n          </FormItem>\n        )} />\n        <Button type="submit" disabled={isLoading}>\n          {isLoading ? 'Saving…' : 'Save'}\n        </Button>\n      </form>\n    </Form>\n  );\n}\n`,
    };
  },

  generateLayoutComponent(name: string): GeneratedFile {
    const pascal = toPascalCase(name);
    return {
      relativePath: `src/layouts/${pascal}Layout.tsx`,
      content:      `${fileHeader(`${pascal} layout`)}import type { ReactNode } from 'react';\n\nexport function ${pascal}Layout({ children }: { children: ReactNode }) {\n  return (\n    <div className="min-h-screen flex flex-col bg-background">\n      <header className="sticky top-0 z-50 border-b bg-background/95 px-6 py-3">\n        <span className="font-semibold">${pascal}</span>\n      </header>\n      <main className="flex-1 p-6 container mx-auto">{children}</main>\n    </div>\n  );\n}\n`,
    };
  },

  generateListComponent(resourceName: string): GeneratedFile {
    return {
      relativePath: `src/components/${toPascalCase(resourceName)}List.tsx`,
      content:      generateCrudComponent(resourceName),
    };
  },
};
