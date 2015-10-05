define(
    [
        'backbone',
        'constants',
        'storyModel'
    ],
    function (
        Backbone,
        constants,
        StoryModel
    ) {
        'use strict';

        var PROPERTIES = constants.story.properties;

        describe('Story model', function() {
           var model;

            describe('On initialize', function() {

                beforeEach(function() {
                    model = new StoryModel({}, {
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
                    model = new StoryModel({}, {
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

                    model = new StoryModel(attrs, {
                        newModel: true
                    });

                    spyOn(model, 'fetch');

                    model.onSaveSuccess();
                });

                it('as new model, should call Backbone fetch() to get further data from api', function() {
                    expect(model.fetch).toHaveBeenCalled();
                })
            });
        });
    }
);
