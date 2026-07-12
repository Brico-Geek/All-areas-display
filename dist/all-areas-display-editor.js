const LitElement = Object.getPrototypeOf(customElements.get("ha-panel-lovelace"));
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

class AllAreasDisplayEditor extends LitElement {
  
  setConfig(config) {
    this._config = config;
  }

  set hass(hass) {
    this._hass = hass;
  }

  displayTypeChanged(ev) {
    const value = ev.target.value;
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: { ...this._config, display_type: value } }
    }));
  }

  columnsChanged(ev) {
    const value = parseInt(ev.target.value, 10);
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: { ...this._config, columns: value } }
    }));
  }

  // Quand la carte modèle change dans le sous-éditeur
  templateChanged(ev) {
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: { ...this._config, card_template: ev.detail.config } }
    }));
  }

  render() {
    if (!this._hass || !this._config) return html``;

    return html`
      <div class="card-config">
        <!-- Choix de l'affichage -->
        <ha-select
          label="Affichage"
          .value=${this._config.display_type || 'grid'}
          @change=${this.displayTypeChanged}
        >
          <mwc-list-item value="grid">Grille (Grid)</mwc-list-item>
          <mwc-list-item value="vertical-stack">Pile Verticale (Vertical Stack)</mwc-list-item>
          <mwc-list-item value="horizontal-stack">Pile Horizontale (Horizontal Stack)</mwc-list-item>
        </ha-select>

        <!-- Colonnes (Conditionnel) -->
        ${this._config.display_type === 'grid' || !this._config.display_type ? html`
          <ha-textfield
            label="Colonnes"
            type="number"
            min="1"
            .value=${this._config.columns || 2}
            @input=${this.columnsChanged}
          ></ha-textfield>
        ` : ''}

        <hr />
        <h3>Configuration du modèle de carte</h3>
        <p style="font-size: 0.9em; color: var(--secondary-text-color);">
          Utilisez <code>[[area_name]]</code>, <code>[[area_id]]</code> ou <code>[[area_icon]]</code> dans les champs ci-dessous.
        </p>

        <!-- Éditeur de carte natif de Home Assistant réutilisé -->
        <hui-card-element-editor
          .hass=${this._hass}
          .value=${this._config.card_template}
          @config-changed=${this.templateChanged}
        ></hui-card-element-editor>
      </div>
    `;
  }

  static get styles() {
    return css`
      .card-config {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      hr {
        border: none;
        border-top: 1px solid var(--divider-color);
        margin: 16px 0;
      }
    `;
  }
}

customElements.define("all-areas-display-editor", AllAreasDisplayEditor);