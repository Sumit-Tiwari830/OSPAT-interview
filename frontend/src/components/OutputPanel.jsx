import React from 'react';

function OutputPanel({ output }) {
    // If we haven't run anything yet
    if (!output) {
        return (
            <div className="h-full bg-[#1e1e1e] flex flex-col border-t border-gray-800">
                <div className="px-4 py-2 bg-gray-900 border-b border-gray-800 font-semibold text-sm text-gray-300">
                    Output
                </div>
                <div className="flex-1 p-4 text-gray-500 font-mono text-sm">
                    Run your code to see the output here...
                </div>
            </div>
        );
    }

    // If it is currently executing on the server
    if (output.status === 'running') {
        return (
            <div className="h-full bg-[#1e1e1e] flex flex-col border-t border-gray-800">
                <div className="px-4 py-2 bg-gray-900 border-b border-gray-800 font-semibold text-sm text-gray-300">
                    Output
                </div>
                <div className="flex-1 p-4 text-blue-400 font-mono text-sm animate-pulse">
                    Compiling and executing on server...
                </div>
            </div>
        );
    }

    // The actual results!
    return (
        <div className="h-full bg-[#1e1e1e] flex flex-col border-t border-gray-800">
            <div className="px-4 py-2 bg-gray-900 border-b border-gray-800 flex justify-between items-center">
                <span className="font-semibold text-sm text-gray-300">Output</span>
                {output.executionTime !== undefined && (
                    <span className="text-xs text-gray-500 font-mono">
                        Time: {output.executionTime}s | Memory: {output.memory} KB
                    </span>
                )}
            </div>
            
            <div className="flex-1 overflow-auto p-4 font-mono text-sm">
                {output.error ? (
                    <pre className="text-red-400 whitespace-pre-wrap">{output.error}</pre>
                ) : (
                    <pre className="text-green-400 whitespace-pre-wrap">{output.output || 'Code executed successfully with no output.'}</pre>
                )}
            </div>
        </div>
    );
}

export default OutputPanel;