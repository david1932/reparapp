/**
 * SearchSelect Component
 * Transforms a standard <select> into a searchable combobox
 */
class SearchSelect {
    /**
     * @param {string} selectId - ID of the source <select> element
     * @param {Object} options - Configuration options
     */
    constructor(selectId, options = {}) {
        this.select = document.getElementById(selectId);
        if (!this.select) {
            console.warn(`SearchSelect: Element #${selectId} not found`);
            return;
        }

        this.wrapper = null;
        this.input = null;
        this.list = null;
        this.optionsData = [];
        this.onSelectCallback = options.onSelect || null;

        this.init();
    }

    init() {
        // Hide original select
        this.select.style.display = 'none';

        // Create UI structure
        this.createUI();

        // Load initial options from select
        this.syncOptionsFromSelect();

        // Bind events
        this.bindEvents();
    }

    createUI() {
        // Wrapper
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'search-select-wrapper';
        this.wrapper.style.position = 'relative';

        // Input
        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.className = 'form-input search-select-input';
        this.input.placeholder = this.select.getAttribute('placeholder') || (window.i18n ? i18n.t('cli_search_placeholder') : 'Buscar...');
        this.input.autocomplete = 'off';

        // Dropdown List
        this.list = document.createElement('div');
        this.list.className = 'search-select-list';
        this.list.style.display = 'none';
        this.list.style.position = 'absolute';
        this.list.style.top = '100%';
        this.list.style.left = '0';
        this.list.style.width = '100%';
        this.list.style.maxHeight = '200px';
        this.list.style.overflowY = 'auto';
        this.list.style.background = 'var(--bg-card)';
        this.list.style.border = '1px solid var(--border-color)';
        this.list.style.borderRadius = '0 0 8px 8px';
        this.list.style.zIndex = '1000';
        this.list.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';

        // Append to DOM
        this.select.parentNode.insertBefore(this.wrapper, this.select);
        this.wrapper.appendChild(this.input);
        this.wrapper.appendChild(this.list);
    }

    syncOptionsFromSelect() {
        this.optionsData = Array.from(this.select.options).map(opt => ({
            value: opt.value,
            text: opt.text,
            search: opt.text.toLowerCase()
        })).filter(opt => opt.value !== ''); // Exclude placeholders if empty value
    }

    setOptions(data) {
        // method to manually set options data [{value, text}, ...]
        this.select.innerHTML = '';
        // Add default/placeholder
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.text = (window.i18n ? i18n.t('rep_sel_client') : 'Seleccionar...');
        this.select.appendChild(defaultOpt);

        data.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.value;
            opt.text = item.text;
            this.select.appendChild(opt);
        });

        this.syncOptionsFromSelect();
    }

    renderList(filterText = '') {
        this.list.innerHTML = '';
        const lowerFilter = filterText.toLowerCase();

        // Filter: Strict Starts With
        const filtered = this.optionsData.filter(opt =>
            opt.search.startsWith(lowerFilter)
        ).sort((a, b) => a.text.localeCompare(b.text));

        if (filtered.length === 0) {
            const noResults = document.createElement('div');
            noResults.style.padding = '8px 12px';
            noResults.style.color = 'var(--text-secondary)';
            noResults.textContent = (window.i18n ? i18n.t('dash_empty_repairs') : 'Sin resultados');
            this.list.appendChild(noResults);
        } else {
            filtered.forEach(opt => {
                const item = document.createElement('div');
                item.className = 'search-select-item';
                item.style.padding = '8px 12px';
                item.style.cursor = 'pointer';
                item.style.borderBottom = '1px solid var(--border-color)';
                item.textContent = opt.text;

                // Highlight on hover (using style for simplicity, css class better)
                item.onmouseenter = () => item.style.background = 'var(--bg-secondary)';
                item.onmouseleave = () => item.style.background = 'transparent';

                item.addEventListener('click', () => {
                    this.selectOption(opt);
                });
                this.list.appendChild(item);
            });
        }

        this.list.style.display = 'block';
    }

    selectOption(option) {
        this.select.value = option.value;
        this.input.value = option.text;
        this.list.style.display = 'none';

        // Trigger change event on original select
        const event = new Event('change', { bubbles: true });
        this.select.dispatchEvent(event);

        if (this.onSelectCallback) {
            this.onSelectCallback(option.value);
        }
    }

    bindEvents() {
        // Input typing
        this.input.addEventListener('input', (e) => {
            this.renderList(e.target.value);
        });

        // Focus show list
        this.input.addEventListener('focus', () => {
            this.renderList(this.input.value);
        });

        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!this.wrapper.contains(e.target)) {
                this.list.style.display = 'none';
            }
        });
    }

    // Public method to reset
    reset() {
        this.input.value = '';
        this.select.value = '';
    }

    // Public method to set value
    setValue(value) {
        this.select.value = value;
        const opt = this.optionsData.find(o => o.value == value); // loose equality for IDs
        if (opt) {
            this.input.value = opt.text;
        } else {
            this.input.value = '';
        }
    }
}
