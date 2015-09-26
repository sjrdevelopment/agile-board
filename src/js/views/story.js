define([
  'jquery',
  'backbone',
  'handlebars',
  'text!hbs/story-template.hbs'
],function(
  $,
  Backbone,
  Handlebars,
  mainTemplate
) {
  var story = Backbone.View.extend({

      tagName: 'div',
      
      className: 'story-row',

      // The DOM events specific to an item.
      events: {

      },

      initialize: function() {
        console.log('initialise view');
       // this.render();
        this.listenTo(this.model.on('change', this.render.bind(this)));
      },

      "mainTemplate":  Handlebars.compile(mainTemplate),

      // Re-renders the titles of the todo item.
      render: function() {
        this.$el.html(this.mainTemplate(this.model.attributes));

        return this;
      }
  });

  return story;

});