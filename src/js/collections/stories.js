define(['backbone', 'storyModel', 'constants'], function(Backbone, Story, constants) {
    
    var PROPERTIES = constants.story.properties,
        Stories;

    Stories = Backbone.Collection.extend({
        model: Story,

        url: constants.apiBaseUrl + PROPERTIES.apiUrl,

        parse: function(response) {
            // return only stories with data (removed stories still occupy an array index in API)
            return _.without(response, null);
        }
    });

    return Stories;
});