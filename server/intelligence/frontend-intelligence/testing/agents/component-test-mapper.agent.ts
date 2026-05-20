import type {
  ComponentDescriptor,
  ComponentTestMapping,
  TestFileDescriptor,
} from "../types.js";
import { componentMatchesTestFile } from "../utils/test-pattern.matcher.util.js";

function findTestFilesForComponent(
  component: ComponentDescriptor,
  testFiles: readonly TestFileDescriptor[]
): readonly string[] {
  const matched: string[] = [];
  for (const testFile of testFiles) {
    if (componentMatchesTestFile(component.name, testFile)) {
      matched.push(testFile.filePath);
    }
  }
  return Object.freeze(matched);
}

export function mapComponentsToTests(
  components: readonly ComponentDescriptor[],
  testFiles: readonly TestFileDescriptor[]
): readonly ComponentTestMapping[] {
  const mappings = components.map((component) => {
    const testedBy = findTestFilesForComponent(component, testFiles);
    return Object.freeze({
      componentId: component.id,
      componentName: component.name,
      filePath: component.filePath,
      testedBy,
      isTested: testedBy.length > 0,
    } satisfies ComponentTestMapping);
  });

  return Object.freeze(mappings);
}
