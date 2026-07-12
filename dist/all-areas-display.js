// ==========================================
// 1. L'ÉDITEUR DE CODE ET COMPOSANTS VISUELS
// ==========================================
class AllAreasDisplayEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._cardYamlEditor && !this._cardYamlEditor.hass) {
      this._cardYamlEditor.hass = hass;
    }
    this._updateExcludedCheckboxes();
  }

  _render() {
    if (this._initialized) {
      this._updateValues();
      return;
    }
    this._initialized = true;

    this.innerHTML = `
      <div class="card-config" style="padding: 10px; display: flex; flex-direction: column; gap: 16px; font-family: var(--paper-font-body1_-_font-family, sans-serif);">
        
        <!-- SECTION 1 : DISPOSITION -->
        <div style="display: flex; flex-direction: column; gap: 10px; border-bottom: 1px solid var(--divider-color); padding-bottom: 14px;">
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <label style="font-weight: bold; color: var(--primary-text-color);">Disposition des pièces :</label>
            <select id="layout-select" style="padding: 8px; border-radius: 4px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color); width: 100%;">
              <option value="auto">Auto (Fluide et extensible)</option>
              <option value="grid">Grille (Grid)</option>
              <option value="vertical">Vertical Stack</option>
              <option value="horizontal">Horizontal Stack</option>
            </select>
          </div>

          <div id="grid-options" style="display: none; gap: 12px; align-items: center; margin-top: 6px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <label style="color: var(--primary-text-color); font-size: 0.9em;">Colonnes (Min 2) :</label>
              <input id="grid-columns" type="number" min="2" max="12" style="width: 50px; padding: 6px; border-radius: 4px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color);" />
            </div>
          </div>

          <div id="square-option-container" style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
            <input id="layout-square" type="checkbox" style="cursor: pointer;" />
            <label for="layout-square" style="color: var(--primary-text-color); font-size: 0.9em; cursor: pointer;">Afficher les cartes en carré</label>
          </div>
        </div>

        <!-- SECTION 2 : PIÈCES BANNIES -->
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <label style="font-weight: bold; color: var(--primary-text-color);">Pièces bannies (Masquées) :</label>
          <div id="excluded-areas-container" style="max-height: 140px; overflow-y: auto; padding: 8px; border: 1px solid var(--divider-color); border-radius: 4px; display: flex; flex-direction: column; gap: 6px; background: var(--secondary-background-color);"></div>
        </div>

        <!-- SECTION 3 : ZONE DE COPIER-COLLER YAML DE LA CARTE ENFANT -->
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <label style="font-weight: bold; color: var(--primary-text-color);">Modèle de la carte (YAML) :</label>
          <p style="margin: 0 0 4px 0; font-size: 0.85em; color: var(--secondary-text-color);">
            Collez ici le YAML d'une carte classique. Utilisez <code>this.area.id</code>, <code>this.area.name</code>, <code>this.area.icon</code>.
          </p>
          <div id="card-yaml-editor-container"></div>
        </div>

      </div>
    `;

    this.querySelector("#layout-select").addEventListener("change", () => this._handleLayoutChange());
    this.querySelector("#grid-columns").addEventListener("input", () => this._handleLayoutChange());
    this.querySelector("#layout-square").addEventListener("change", () => this._handleLayoutChange());

    const yamlContainer = this.querySelector("#card-yaml-editor-container");
    this._cardYamlEditor = document.createElement("ha-code-editor");
    this._cardYamlEditor.mode = "yaml";
    this._cardYamlEditor.autofocus = false;
    
    // Récupération de la config enfant ou fallback par défaut
    const initialCardConfig = this._config.card || { type: "area", area: "this.area.id" };
    
    // Utilisation sécurisée du parseur natif Home Assistant pour forcer l'indentation à 2 espaces
    const hassYaml = window.jsyaml || null;
    if (hassYaml && typeof hassYaml.dump === "function") {
      this._cardYamlEditor.value = hassYaml.dump(initialCardConfig, { indent: 2, lineWidth: -1 });
    } else {
      // Fallback si jsyaml n'est pas exposé globalement au premier chargement
      this._cardYamlEditor.value = Object.entries(initialCardConfig)
        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('\n');
    }

    // Écoute des changements de frappe dans l'éditeur YAML
    this._cardYamlEditor.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      const rawValue = ev.detail.value;
      
      try {
        const parser = window.jsyaml || null;
        if (parser && typeof parser.load === "function") {
          const parsedCard = parser.load(rawValue);
          
          if (parsedCard && typeof parsedCard === 'object') {
            // Remplacement propre de la sous-configuration
            this._config = { ...this._config, card: parsedCard };
            
            // Notification immédiate à Home Assistant pour actualiser la prévisualisation de la carte
            this.dispatchEvent(new CustomEvent("config-changed", {
              detail: { config: this._config },
              bubbles: true,
              composed: true,
            }));
          }
        }
      } catch (err) {
        // On n'affiche rien dans la console pendant que l'utilisateur tape (YAML temporairement invalide)
      }
    });

    yamlContainer.appendChild(this._cardYamlEditor);
    this._updateValues();
  }

  _handleLayoutChange() {
    const selectType = this.querySelector("#layout-select").value;
    const isSquare = this.querySelector("#layout-square").checked;
    let newLayout = { type: "grid" };

    if (selectType === "vertical") {
      newLayout = { type: "vertical-stack" };
    } else if (selectType === "horizontal") {
      newLayout = { type: "horizontal-stack" };
    } else if (selectType === "auto") {
      newLayout = { type: "auto" };
    } else if (selectType === "grid") {
      const inputCols = parseInt(this.querySelector("#grid-columns").value) || 2;
      const cols = Math.max(2, inputCols);
      newLayout = { type: "grid", columns: cols };
    }

    if (selectType === "grid" || selectType === "auto") {
      newLayout.square = isSquare;
    }

    this._updateConfig({ layout: newLayout });
  }

  _updateValues() {
    if (!this._config) return;
    const select = this.querySelector("#layout-select");
    const gridOptions = this.querySelector("#grid-options");
    const squareContainer = this.querySelector("#square-option-container");
    const colsInput = this.querySelector("#grid-columns");
    const squareCheckbox = this.querySelector("#layout-square");

    if (!select) return;

    const layout = this._config.layout || { type: "auto" };
    
    if (layout.type === "vertical-stack") {
      select.value = "vertical";
      gridOptions.style.display = "none";
      squareContainer.style.display = "none";
    } else if (layout.type === "horizontal-stack") {
      select.value = "horizontal";
      gridOptions.style.display = "none";
      squareContainer.style.display = "none";
    } else if (layout.type === "grid") {
      select.value = "grid";
      gridOptions.style.display = "flex";
      squareContainer.style.display = "flex";
      colsInput.value = Math.max(2, layout.columns || 2);
      squareCheckbox.checked = layout.square || false;
    } else {
      select.value = "auto";
      gridOptions.style.display = "none";
      squareContainer.style.display = "flex";
      squareCheckbox.checked = layout.square || false;
    }
  }

  _updateExcludedCheckboxes() {
    const container = this.querySelector("#excluded-areas-container");
    if (!container || !this._hass || !this._hass.areas) return;

    const currentExclusions = (this._config.exclude || []).map(item => String(item).toLowerCase());
    const areas = Object.values(this._hass.areas);

    if (container.children.length === areas.length) return;

    container.innerHTML = "";
    areas.sort((a, b) => (a.name || "").localeCompare(b.name || "")).forEach(area => {
      const label = document.createElement("label");
      label.style.display = "flex";
      label.style.alignItems = "center";
      label.style.gap = "8px";
      label.style.color = "var(--primary-text-color)";
      label.style.cursor = "pointer";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = currentExclusions.includes(area.area_id.toLowerCase()) || (area.name && currentExclusions.includes(area.name.toLowerCase()));
      
      checkbox.addEventListener("change", () => {
        let exclusions = [...(this._config.exclude || [])];
        if (checkbox.checked) {
          if (!exclusions.includes(area.area_id)) exclusions.push(area.area_id);
        } else {
          exclusions = exclusions.filter(item => item.toLowerCase() !== area.area_id.toLowerCase() && (area.name ? item.toLowerCase() !== area.name.toLowerCase() : true));
        }
        this._updateConfig({ exclude: exclusions });
      });

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(area.name || area.area_id));
      container.appendChild(label);
    });
  }

  _updateConfig(newProps) {
    this._config = { ...this._config, ...newProps };
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    }));
  }
}
customElements.define('all-areas-display-editor', AllAreasDisplayEditor);