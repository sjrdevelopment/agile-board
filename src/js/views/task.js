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
        "click .task-delete-button": "onTaskDeleteClick"
      },

      initialize: function() {
        console.log('initialise tasks view');

        this.render();


        this.$el.addClass('priority-' + this.model.get("priority"));


        this.listenTo(this.model.on('change:modified', this.render.bind(this)));

        this.listenTo(this.model.on('destroy', _.bind(this.removeView, this)));

       
      },

      removeView: function() {
        this.remove();
      },

      "mainTemplate":  Handlebars.compile(mainTemplate),

      // Re-renders the titles of the todo item.
      render: function() {
        // *****
        debugger; // task view render
        // *****

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
        
      },

      onTaskDeleteClick: function() {
        var r = confirm('Are you sure you want to delete the task "' + this.model.get('description') + '"?');
        if (r == true) {
            this.model.destroy();
        } else {
            return;
        }
        
      }

  });

  return task;

});