class AllAreasDisplay extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;

    // 1. Créer le conteneur de base s'il n'existe pas
    if (!this.content) {
      this.innerHTML = `<div id="card-container"></div>`;
      this.content = this.querySelector('#card-container');
    }

    // Éviter de tout reconstruire à chaque changement d'état des entités
    if (this._initialized) {
      if (this._layoutElement) this._layoutElement.hass = hass;
      return;
    }
    this._initialized = true;

    this._buildCards();
  }

  async _buildCards() {
    const config = this._config;
    const hass = this._hass;
    
    // Récupérer les pièces depuis le registre officiel de HA
    const areas = Object.values(hass.areas || {});

    // 2. Préparer la configuration globale du conteneur (Grille par défaut)
    const layoutConfig = {
      type: config.layout_type || 'grid',
      columns: config.layout_options?.columns || 2,
      square: config.layout_options?.square || false,
      cards: []
    };

    // 3. Boucler sur les pièces et injecter les variables dynamiques
    areas.forEach(area => {
      const areaId = area.area_id;
      const areaName = area.name;
      const areaSlug = areaId.toLowerCase().replace(/ /g, '_');

      // Chercher un capteur de température lié à cette pièce pour la variable [[area_temp]]
      let areaTemp = "N/A";
      const tempEntity = Object.values(hass.states).find(state => 
        state.entity_id.startsWith('sensor.') && 
        state.entity_id.includes('temperature') && 
        hass.entities[state.entity_id]?.area_id === areaId
      );
      if (tempEntity) areaTemp = tempEntity.state + (tempEntity.attributes.unit_of_measurement || '°C');

      // Fonction pour cloner le YAML et remplacer les tags personnalisés
      const replaceVariables = (obj) => {
        let str = JSON.stringify(obj);
        str = str.replaceAll('[[area_id]]', areaId);
        str = str.replaceAll('[[area_name]]', areaName);
        str = str.replaceAll('[[area_slug]]', areaSlug);
        str = str.replaceAll('[[area_temp]]', areaTemp);
        return JSON.parse(str);
      };

      // Ajouter le bouton si défini
      if (config.button_template) {
        layoutConfig.cards.push(replaceVariables(config.button_template));
      }
      // Ajouter la popup si définie
      if (config.popup_template) {
        layoutConfig.cards.push(replaceVariables(config.popup_template));
      }
    });

    // 4. Utiliser le créateur de carte officiel de HA pour compiler le tout
    const helpers = await window.loadCardHelpers();
    const element = helpers.createCardElement(layoutConfig);
    element.hass = hass;

    this.content.innerHTML = '';
    this.content.appendChild(element);
    this._layoutElement = element;
  }

  setConfig(config) {
    if (!config.button_template) {
      throw new Error("Tu dois spécifier un 'button_template'.");
    }
    this._config = config;
  }

  getCardSize() {
    return 3;
  }
}

// Déclaration officielle du nouveau nom de la carte
customElements.define('all-areas-display', AllAreasDisplay);