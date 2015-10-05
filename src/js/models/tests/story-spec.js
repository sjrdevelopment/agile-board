define(
    [
        'backbone',
        'constants',
        'storyModel'
    ],
    function (
        Backbone,
        constants,
        storyModel
    ) {
        'use strict';

        var PROPERTIES = constants.story.properties;

        describe('Story model', function() {
           var model;

            describe('On initialize', function() {

                beforeEach(function() {
                    model = new storyModel([], {
                        newModel: true
                    });
                });


                it('should inherit from Backbone.Model', function() {
                    expect(model instanceof Backbone.Model).toBe(true);
                });

            });

            describe('on syncWithApi', function() {
                var dummyChangedAttributes = {};

                beforeEach(function() {
                    model = new storyModel([], {
                        newModel: true
                    });

                    spyOn(model, 'save');

                    dummyChangedAttributes = {
                        param: 'param value'
                    }

                    model.syncWithApi(dummyChangedAttributes);
                });

                it('should call Backbone model save() function', function() {


                    expect(model.save).toHaveBeenCalled();
                    expect(model.save.calls.argsFor(0)[0]).toEqual(dummyChangedAttributes);
                });
            });

            describe('onSaveSuccess', function() {
                var attrs = {};

                beforeEach(function() {
                    attrs[PROPERTIES.priority] = 1;

                    model = new storyModel(attrs);

                    model.setPriority();
                });


            });
        });



/*
        setPriority: function(options, response) {
            if (this.newModel) {

                this.set(PROPERTIES.idAttribute, response);

                this.fetch({
                    success: _.bind(this.syncedModel, this)
                });
            }
        },

        validate: function(attrs, options) {

        },

        showError: function(error, options) {

        },

        syncWithApi:  function(changedAttributes) {
            if (!_.isEmpty(changedAttributes)) {
                this.save(changedAttributes, {patch:true, error: this.showError, success: _.bind(this.setPriority, this)});
            }
        */
    }
);
