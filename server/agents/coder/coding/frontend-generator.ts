interface GeneratedFile { content: string; relativePath: string; }

export const frontendGenerator = {
  generatePage(name: string): GeneratedFile {
    const pascal = name.charAt(0).toUpperCase() + name.slice(1);
    return {
      relativePath: `client/src/pages/${pascal}.tsx`,
      content: `import React from 'react';\n\nexport default function ${pascal}Page() {\n  return <div className="p-4"><h1>${pascal}</h1></div>;\n}\n`,
    };
  },
  generateLayout(name: string): GeneratedFile {
    const pascal = name.charAt(0).toUpperCase() + name.slice(1);
    return {
      relativePath: `client/src/layouts/${pascal}Layout.tsx`,
      content: `import React from 'react';\n\nexport default function ${pascal}Layout({ children }: { children: React.ReactNode }) {\n  return <div className="layout">{children}</div>;\n}\n`,
    };
  },
  generateHook(name: string, _resource: string): GeneratedFile {
    const camel = 'use' + name.charAt(0).toUpperCase() + name.slice(1);
    return {
      relativePath: `client/src/hooks/${camel}.ts`,
      content: `import { useState } from 'react';\n\nexport function ${camel}() {\n  const [data, setData] = useState(null);\n  return { data, setData };\n}\n`,
    };
  },
};
