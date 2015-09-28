define(['backbone', 'storyModel', 'constants'], function(Backbone, Story, constants) {
    
    var PROPERTIES = constants.storiesCollection.properties,
        Stories;

    Stories = Backbone.Collection.extend({
        model: Story,

        url: constants.apiBaseUrl + PROPERTIES.apiUrl
    });

    return Stories;
});