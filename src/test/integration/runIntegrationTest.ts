/*---------------------------------------------------------------------------------------------
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from "path";
import * as cp from "child_process";
import * as fs from "fs";
import * as os from "os";

import { runTests } from "vscode-test";

async function main() {
    try {
        // Create a temp directory to serve as our test workspace
        const testWorkspace = fs.mkdtempSync(
            path.join(os.tmpdir(), "vscode-hg-integration-")
        );

        console.log(`Integration test workspace: ${testWorkspace}`);

        // Initialize an hg repo in the test workspace
        cp.execSync("hg init", { cwd: testWorkspace });

        // The folder containing the Extension Manifest package.json
        const extensionDevelopmentPath = path.resolve(__dirname, "../../../");

        // The path to the integration test runner
        const extensionTestsPath = path.resolve(__dirname, "./suite/index");

        // Use a pre-installed VS Code if VSCODE_EXECUTABLE_PATH is set,
        // otherwise download VS Code automatically.
        const vscodeExecutablePath = process.env.VSCODE_EXECUTABLE_PATH;

        // Download VS Code, unzip it and run the integration test
        await runTests({
            vscodeExecutablePath,
            extensionDevelopmentPath,
            extensionTestsPath,
            // First arg is the workspace folder to open
            launchArgs: [
                testWorkspace,
                "--disable-extensions",
            ],
            // Pass the workspace path so tests can find it
            extensionTestsEnv: {
                VSCODE_HG_TEST_WORKSPACE: testWorkspace,
            },
        });
    } catch (err) {
        console.error("Failed to run integration tests:", err);
        process.exit(1);
    }
}

main();
