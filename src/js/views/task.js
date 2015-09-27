define([
  'jquery',
  'backbone',
  'handlebars',
  'editTaskView',
  'editTaskModel',
  'text!hbs/task-template.hbs'
],function(
  $,
  Backbone,
  Handlebars,
  EditTaskView,
  EditTaskModel,
  mainTemplate
) {
  var task = Backbone.View.extend({

      tagName: 'div',
      
      className: 'task-card',

      // The DOM events specific to an item.
      events: {
        "click .task-edit-button": "onTaskEditClick",
      },

      initialize: function() {
        console.log('initialise tasks view');

        this.render();
        this.listenTo(this.model.on('change', this.render.bind(this)));


        this.$el.addClass('priority-' + this.model.get("priority"));



        //this.model.on('change', this.someBloodyFunction);
      },

  

      "mainTemplate":  Handlebars.compile(mainTemplate),

      // Re-renders the titles of the todo item.
      render: function() {
        
        this.$el.html(this.mainTemplate(this.model.attributes));
        this.placeTaskCard();

        return this;
      },

      placeTaskCard: function() {
        $('.story-card')
          .filter('[data-story-id="' + this.model.get('story_id') + '"]')
          .next('table')
          .find('.status-' + this.model.get('status').replace(/\s+/g, ''))
          .append(this.$el);
      },

      onTaskEditClick: function() {
        debugger;
        
        //var thisTaskModel = this.model;

        var editTask = new EditTaskView({
          model: new EditTaskModel({
            taskModel: this.model
          })
        });
        
      }
  });

  return task;

});