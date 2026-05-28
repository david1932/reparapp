/**
 * SecurityManager.js
 * Handles Anti-Debug, VM Detection and Application Integrity.
 */
class SecurityManager {
    constructor() {
        this.isVM = false;
        this.isDebuggerOpen = false;
        this.init();
    }

    async init() {
        console.log("SecurityManager: Initializing protection layers...");
        this.detectVM();
        await this.checkOSSecurity();
        this.setupAntiDebug();
        this.checkIntegrity();
    }

    async checkOSSecurity() {
        if (window.api && window.api.security) {
            try {
                const res = await window.api.security.checkOSSecurity();
                console.log("SecurityManager: OS Security Check ->", res);
                if (res.isVM) {
                    console.warn("SecurityManager: OS Level Virtual Machine detected:", res.details);
                    this.isVM = true;
                    window.is_running_in_vm = true;
                }
                if (res.isDevToolsOpen) {
                    this.onDevToolsOpen();
                }
            } catch (err) {
                console.error("SecurityManager: OS Security Check failed:", err);
            }
        }
    }

    /**
     * Detects if the application is running inside a Virtual Machine.
     * Checks CPU, RAM, and GPU.
     */
    detectVM() {
        const specs = {
            cores: navigator.hardwareConcurrency || 0,
            memory: navigator.deviceMemory || 0,
            width: window.screen.width,
            height: window.screen.height
        };

        // CPU/RAM heuristic (Relaxed: only trigger if both are very low)
        if (specs.cores < 2 && specs.memory < 4) {
            console.warn("SecurityManager: Extremely low hardware resources detected. Possible VM.");
            // this.isVM = true; // Don't automatically lock on resources alone
        }

        // Screen resolution (Common VM defaults)
        if ((specs.width === 800 && specs.height === 600) || (specs.width === 1024 && specs.height === 768)) {
            console.warn("SecurityManager: VM-like resolution detected. Triggering warning.");
        }

        // GPU Detection
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (gl) {
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).toLowerCase();
                    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL).toLowerCase();

                    if ((renderer.includes('software') ||
                        renderer.includes('virtual') ||
                        renderer.includes('vmware')) && !renderer.includes('rtx') && !renderer.includes('radeon')) {
                        console.warn("SecurityManager: Virtualized GPU detected:", renderer);
                        this.isVM = true;
                    }
                }
            }
        } catch (e) {
            console.error("SecurityManager: GPU detection failed", e);
        }

        if (this.isVM) {
            // In a real commercial app, you might block access here.
            // For now, we log and could add a flag to the license server check.
            window.is_running_in_vm = true;
        }
    }

    /**
     * Prevents easy debugging by using devtools detection and loops.
     */
    setupAntiDebug() {
        // Simple trick to detect DevTools opening
        const element = new Image();
        Object.defineProperty(element, 'id', {
            get: () => {
                this.onDevToolsOpen();
            }
        });

        setInterval(() => {
            // console.log(element);
            // console.clear(); // Disabled to allow debugging license issues
        }, 2000);

        // Debugger loop
        (function () {
            const check = function () {
                const start = performance.now();
                debugger;
                const end = performance.now();
                if (end - start > 100) {
                    // Debugger was hit
                    window.location.reload();
                }
            };
            // setInterval(check, 1000); // Triggering reload might be too aggressive during dev, but good for PRO
        })();
    }

    onDevToolsOpen() {
        if (this.isDebuggerOpen) return;
        this.isDebuggerOpen = true;
        console.error("SecurityManager: Developers Tools detected! This action is logged.");
        // Potential action: app.showToast("Unauthorized access to DevTools detected", "warning");
    }

    /**
     * Basic check for code integrity.
     */
    checkIntegrity() {
        // Check if certain global variables are as expected
        // Check if app is running from expected origin or local path
        const isElectron = navigator.userAgent.toLowerCase().indexOf(' electron/') > -1;
        if (!isElectron && !window.location.hostname.includes('github.io') && window.location.hostname !== 'localhost') {
            console.warn("SecurityManager: Untrusted origin.");
        }
    }
}

// Global instance
window.securityManager = new SecurityManager();
