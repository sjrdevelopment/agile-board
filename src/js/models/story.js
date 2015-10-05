define(['backbone', 'constants', 'underscore'], function(Backbone, constants, _) {

    var PROPERTIES = constants.story.properties,
        StoryModel;

    StoryModel = Backbone.Model.extend({
        
        initialize: function(attr, options) {
            this.urlRoot = PROPERTIES.apiUrl;
            this.idAttribute = PROPERTIES.idAttribute;

            if (options && options.newModel) {
                this.newModel = true;
            }

            this.set(PROPERTIES.created, this.formatDateTime(this.get(PROPERTIES.created)));
            this.set(PROPERTIES.modified, this.formatDateTime(this.get(PROPERTIES.modified)));
        },

        showError: function(error) {
            console.log(error);
        },

        onSaveSuccess: function(options, response) {
         
            if (this.newModel) {
                this.set(PROPERTIES.idAttribute, response);
                this.fetch({success: _.bind(function(model, response, options) {
                    this.set(PROPERTIES.created, this.formatDateTime(response[PROPERTIES.created]));
                    this.set(PROPERTIES.modified, this.formatDateTime(response[PROPERTIES.modified]));
                }, this)});
                this.newModel = false;
            }
        },

        syncWithApi:  function(changedAttributes) {
            if (!_.isEmpty(changedAttributes)) {
                this.save(changedAttributes, {patch:true, error: this.showError, success: _.bind(this.onSaveSuccess, this)});
            }
        },

        formatDateTime: function(timestamp) {
            if (timestamp) {
                var date = new Date(timestamp);
                
                return date.toLocaleString();
            }
        }
    });

    return StoryModel;
});