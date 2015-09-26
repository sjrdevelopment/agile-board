define([
  'jquery',
  'backbone',
  'handlebars',
  'text!hbs/main-template.hbs'
],function(
  $,
  Backbone,
  Handlebars,
  mainTemplate
) {
  var MainView = Backbone.View.extend({

      el:  ".name-area",

      tagName: 'h1',

      // The DOM events specific to an item.
      events: {

      },

      initialize: function() {
        console.log('initialise view');
        this.render();
        this.listenTo(this.model.on('change', this.render.bind(this)));
      },

      "mainTemplate":  Handlebars.compile(mainTemplate),

      // Re-renders the titles of the todo item.
      render: function() {
        this.$el.html(this.mainTemplate(this.model.attributes));

        return this;
      }
  });

  return MainView;

});