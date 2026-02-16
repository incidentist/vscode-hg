/*---------------------------------------------------------------------------------------------
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import "mocha";
import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { extensions, commands } from "vscode";
import { Model } from "../../../model";
import { Repository } from "../../../repository";
import { eventToPromise } from "../../../util";

suite("Integration: Untracked Files", function () {
    this.timeout(60000);

    const testWorkspace = process.env.VSCODE_HG_TEST_WORKSPACE!;
    let model: Model;
    let repository: Repository;

    function filePath(relativePath: string): string {
        return path.join(testWorkspace, relativePath);
    }

    suiteSetup(async function () {
        // The workspace was pre-initialized with `hg init` by the test runner.
        // Activate the extension and wait for it to discover the repository.
        assert.ok(
            testWorkspace,
            "VSCODE_HG_TEST_WORKSPACE env var must be set"
        );
        assert.ok(
            fs.existsSync(path.join(testWorkspace, ".hg")),
            "Test workspace must be an hg repository"
        );

        const ext = extensions.getExtension("mrcrowl.hg");
        assert.ok(ext, "mrcrowl.hg extension must be available");

        model = await ext!.activate();
        assert.ok(model, "Extension activation must return a Model");

        // The extension should auto-discover the repo from the workspace folder.
        // If it hasn't opened yet, wait for it.
        if (model.repositories.length === 0) {
            await eventToPromise(model.onDidOpenRepository);
        }

        assert.strictEqual(
            model.repositories.length,
            1,
            "Should have exactly one repository"
        );
        repository = model.repositories[0];

        // Ensure we start with a clean state
        await repository.status();
    });

    test("an untracked file appears in the untracked resource group", async function () {
        // Create a new file in the workspace (not tracked by hg)
        const untrackedFile = filePath("untracked-file.txt");
        fs.writeFileSync(untrackedFile, "hello world", "utf8");

        // Open the SCM view and refresh status
        await commands.executeCommand("workbench.view.scm");
        await repository.status();

        // The file should show up in the untracked group
        const untrackedResources = repository.untrackedGroup.resources;
        assert.strictEqual(
            untrackedResources.length,
            1,
            "Should have exactly one untracked resource"
        );

        const resource = untrackedResources[0];
        assert.strictEqual(
            path.basename(resource.resourceUri.fsPath),
            "untracked-file.txt",
            "Untracked resource should be untracked-file.txt"
        );

        // Other groups should be empty
        assert.strictEqual(
            repository.workingDirectoryGroup.resources.length,
            0,
            "Working directory group should be empty"
        );
        assert.strictEqual(
            repository.stagingGroup.resources.length,
            0,
            "Staging group should be empty"
        );
        assert.strictEqual(
            repository.mergeGroup.resources.length,
            0,
            "Merge group should be empty"
        );
        assert.strictEqual(
            repository.conflictGroup.resources.length,
            0,
            "Conflict group should be empty"
        );
    });

    test("multiple untracked files are all detected", async function () {
        // Create additional untracked files
        fs.writeFileSync(filePath("another-file.txt"), "content", "utf8");
        fs.mkdirSync(filePath("subdir"), { recursive: true });
        fs.writeFileSync(
            filePath("subdir/nested-file.txt"),
            "nested content",
            "utf8"
        );

        await repository.status();

        // Should now have 3 untracked files (including the one from the previous test)
        const untrackedResources = repository.untrackedGroup.resources;
        assert.strictEqual(
            untrackedResources.length,
            3,
            "Should have three untracked resources"
        );

        const filenames = untrackedResources
            .map((r) => {
                const rel = path.relative(testWorkspace, r.resourceUri.fsPath);
                // Normalize path separators for cross-platform
                return rel.replace(/\\/g, "/");
            })
            .sort();

        assert.deepStrictEqual(filenames, [
            "another-file.txt",
            "subdir/nested-file.txt",
            "untracked-file.txt",
        ]);
    });

    test("adding an untracked file moves it to the working directory group", async function () {
        // Start fresh: clean up files from previous tests and create one new file
        const files = ["untracked-file.txt", "another-file.txt"];
        for (const f of files) {
            if (fs.existsSync(filePath(f))) {
                fs.unlinkSync(filePath(f));
            }
        }
        if (fs.existsSync(filePath("subdir/nested-file.txt"))) {
            fs.unlinkSync(filePath("subdir/nested-file.txt"));
        }
        if (fs.existsSync(filePath("subdir"))) {
            fs.rmdirSync(filePath("subdir"));
        }

        // Create a single untracked file
        fs.writeFileSync(filePath("to-be-added.txt"), "add me", "utf8");
        await repository.status();

        assert.strictEqual(
            repository.untrackedGroup.resources.length,
            1,
            "Should have one untracked file before adding"
        );

        // Add all untracked files via the hg.addAll command
        await commands.executeCommand("hg.addAll");
        await repository.status();

        // The file should have moved from untracked to working directory
        assert.strictEqual(
            repository.untrackedGroup.resources.length,
            0,
            "Untracked group should be empty after adding"
        );
        assert.strictEqual(
            repository.workingDirectoryGroup.resources.length,
            1,
            "Working directory group should have the added file"
        );

        const addedResource =
            repository.workingDirectoryGroup.resources[0];
        assert.strictEqual(
            path.basename(addedResource.resourceUri.fsPath),
            "to-be-added.txt",
            "Added resource should be to-be-added.txt"
        );
    });
});
