import child_process from 'child_process';
import path from 'path';


class LavalinkProcessController {
    public lavalinkJarPath: string;
    #lavalinkProcess: child_process.ChildProcessWithoutNullStreams;

    constructor(lavalinkJarPath: any) {
        this.lavalinkJarPath = String(lavalinkJarPath);
        this.#startLavalink(this.lavalinkJarPath);
    }


    #startLavalink(lavalinkJarPath: string) {
        const lavalinkDir = path.dirname(lavalinkJarPath);
        const lavalinkJar = path.basename(lavalinkJarPath);

        process.chdir(lavalinkDir);

        this.#lavalinkProcess = child_process.spawn('java', ['-jar', lavalinkJar]);

        this.#eventHandle();
        this.#sendStatusCode('LAVALINK_STARTED');
    }

    #eventHandle() {
        this.#lavalinkProcess.on('exit', (code, signal) => {
            const exitCode = (code ?? signal ?? 1) as number;
            console.log(`[localNode] process exited with code ${exitCode}`);
            process.exit(exitCode);
        });


        this.#lavalinkProcess.stdout.on('data', (data) => {
            //console.log(`[localNode][out] ${data}`);

            // Deserialization
            data = Buffer.from(data).toString('utf-8');

            process.send!(data);

            if (data.includes('Lavalink is ready to accept connections.')) {
                this.#sendStatusCode('LAVALINK_READY');
            }
            else if (data.includes('Undertow started on port(s)')) {
                const match = data.match(/port\(s\) (\d+)/);
                const port = match && match[1];
                this.#sendStatusCode(`LAVALINK_PORT_${port}`);
            }
        });

        this.#lavalinkProcess.stderr.on('data', (data) => {
            //console.error(`[localNode][err] ${data}`);

            // Deserialization
            data = Buffer.from(data).toString('utf-8');

            process.send!(data);
        });
    }


    /**
     * Send status code
     */
    #sendStatusCode(status: string) {
        const validStatusCodes = ['LAVALINK_STARTED', 'LAVALINK_READY'];
        const portRegex = /^LAVALINK_PORT_(\d+)$/;

        if (validStatusCodes.includes(status) || portRegex.test(status)) {
            process.send!(status);
        }
        else {
            console.error(`Invalid status: ${status}`);
        }
    }
}


/**
 * Because the working directory of the lavalink process 
 * is different from the main process, 
 * another child process is opened to run.
 */

process.once('message', (message) => {
    // Wait for the .jar path to be received before running local node
    const lavalinkJarPath = String(message);
    new LavalinkProcessController(lavalinkJarPath);
});
