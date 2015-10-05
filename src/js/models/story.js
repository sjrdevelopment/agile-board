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
        },

        showError: function(error) {
            console.log(error);
        },

        onSaveSuccess: function(options, response) {
            if (this.newModel) {
                this.set(PROPERTIES.idAttribute, response);
                this.fetch();
                this.newModel = false;
            }
        },

        syncWithApi:  function(changedAttributes) {
            if (!_.isEmpty(changedAttributes)) {
                this.save(changedAttributes, {patch:true, error: this.showError, success: _.bind(this.onSaveSuccess, this)});
            }
        }
    });

    return StoryModel;
});