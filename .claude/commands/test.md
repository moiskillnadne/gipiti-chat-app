# Unit Test Generation Session

## Input
I'll specify a file or directory to cover with tests. If not specified, scan the project for files/directories with low or zero test coverage that would benefit most from testing (prioritize: utils, services, database queries, shared logic).

## Step 1: Analysis
For the target file(s):
- Read and understand every exported function/class
- Identify edge cases, error paths, and boundary conditions
- Check if tests already exist (look for *.test.ts, *.spec.ts, __tests__/)
- Identify dependencies that need mocking (database, external APIs, etc.)

## Step 2: Report (STOP and wait for approval)

**Target:** [file(s) to test]
**Functions to cover:** [list of exports with brief description]
**Mocking strategy:** [what needs to be mocked and how]
**Test file location:** [where test files will be created]
**Estimated test count:** [number of test cases]

Present a brief outline of test cases grouped by function. Example:
- `getUserById` — happy path, user not found, invalid id, db error
- `createUser` — success, duplicate email, validation error

DO NOT write any code yet. Wait for approval.

## Step 3: Execute (only after approval)
Write tests following these principles:
- One test file per source file
- Use describe/it blocks grouped by function
- Test names should read as sentences: `it('returns null when user is not found')`
- Follow AAA pattern: Arrange → Act → Assert
- Cover: happy path, error cases, edge cases, boundary values
- Mock external dependencies, don't mock the function under test
- After writing, run the tests to make sure they pass

## Rules
- Use the existing test framework in the project (detect from package.json)
- If no test framework exists, suggest one and wait for approval before installing
- Match existing test patterns/conventions if tests already exist in the project
- Don't test implementation details — test behavior and contracts
- Don't test trivial getters/setters
- Keep mocks minimal and close to the test
- TypeScript for all test files