/*
 * W3C Software License
 *
 * Copyright (c) 2017 the thingweb community
 *
 * THIS WORK IS PROVIDED "AS IS," AND COPYRIGHT HOLDERS MAKE NO REPRESENTATIONS OR
 * WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO, WARRANTIES OF
 * MERCHANTABILITY OR FITNESS FOR ANY PARTICULAR PURPOSE OR THAT THE USE OF THE
 * SOFTWARE OR DOCUMENT WILL NOT INFRINGE ANY THIRD PARTY PATENTS, COPYRIGHTS,
 * TRADEMARKS OR OTHER RIGHTS.
 *
 * COPYRIGHT HOLDERS WILL NOT BE LIABLE FOR ANY DIRECT, INDIRECT, SPECIAL OR
 * CONSEQUENTIAL DAMAGES ARISING OUT OF ANY USE OF THE SOFTWARE OR DOCUMENT.
 *
 * The name and trademarks of copyright holders may NOT be used in advertising or
 * publicity pertaining to the work without specific, written prior permission. Title
 * to copyright in this work will at all times remain with copyright holders.
 */

/**
 * Basic test suite to demonstrate test setup
 * uncomment the @skip to see failing tests
 * 
 * h0ru5: there is currently some problem with VSC failing to recognize experimentalDecorators option, it is present in both tsconfigs
 */

import { suite, test, slow, timeout, skip, only } from "mocha-typescript";
import { expect, should } from "chai";
// should must be called to augment all variables
should();

import Servient from "../src/servient";
import * as listeners from "../src/resource-listeners/all-resource-listeners";
import {ProtocolServer,Content,ResourceListener} from "../src/resource-listeners/protocol-interfaces"
import ExposedThing from "../src/exposed-thing";

// implement a testserver to mock a server
class TestProtocolServer implements ProtocolServer {

    public readonly scheme: string = "test";
    private listeners: Map<string, ResourceListener> = new Map();

    getListenerFor(path: string): ResourceListener {
        return this.listeners.get(path);
    }

    addResource(path: string, res: ResourceListener): boolean {
        if (this.listeners.has(path)) return false;
        this.listeners.set(path, res);
    }

    removeResource(path: string): boolean {
        return true;
    }

    start(): Promise<void> { return new Promise<void>((resolve, reject) => { resolve(); }); }
    stop(): Promise<void> { return new Promise<void>((resolve, reject) => { resolve(); }); }
    getPort(): number { return -1 }
}

@suite("the server side of servient")
class WoTServerTest {

    static servient: Servient;
    static WoT: WoT.WoTFactory;
    static server: TestProtocolServer;

    static before() {
        this.servient = new Servient();
        this.server = new TestProtocolServer();
        this.servient.addServer(this.server);
        this.servient.start().then( WoTruntime => { this.WoT = WoTruntime; });
        console.log("before starting test suite");
    }

    static after() {
        console.log("after finishing test suite");
        this.servient.shutdown();
    }

    @test "should be able to add a thing"() {
        let thing : WoT.ExposedThing = WoTServerTest.WoT.expose({
            name : "myThing"
        });
        
        //.then(thing => {
            expect(thing).to.exist;
            expect(thing).to.have.property("name", "myThing");
        //});
    }

    
    // @test "should be able to add a thing based on a given description"() {
    //     let desc = `{
    //         "@context": ["http://w3c.github.io/wot/w3c-wot-td-context.jsonld"],
    //         "@type": ["Thing"],
    //         "name": "myThingX",
    //         "interaction": []
    //     }`;

    //     let thing : WoT.ExposedThing = WoTServerTest.WoT.expose({
    //         name : "undefined", 
    //         url : "", 
    //         description : JSON.parse(desc)
    //     });
    //     // .then(thing => {
    //         expect(thing).to.exist;
    //         expect(thing).to.have.property("name", "myThingX");
    //     //});
    // }    


    // @test "should be able to add a thing based on a given description with property&action"() {
    //     let desc = `{
    //         "@context": ["http://w3c.github.io/wot/w3c-wot-td-context.jsonld"],
    //         "@type": ["Thing"],
    //         "name": "myThingY",
    //         "interaction": [
    //             {
    //                 "@type": ["Property"],
    //                 "name": "humidity",
    //                 "outputData": { "type": "number" },
    //                 "writable": false,
    //                 "link": [{
    //                   "href" : "/humid",
    //                   "mediaType": "application/json"
    //                   }]
    //             }
    //             ,
    //             {
    //                 "@type": ["Action"],
    //                 "name": "toggle",
    //                 "link": [{
    //                     "href": "coaps://mylamp.example.com:5683/toggle",
    //                     "mediaType": "application/json"
    //                 }]
    //             }
    //         ]
    //     }`;

    //     let thing : WoT.ExposedThing = WoTServerTest.WoT.expose({
    //         name : "undefined", 
    //         url : "", 
    //         description : JSON.parse(desc)
    //     });
    //     //.then(thing => {
    //         expect(thing).to.exist;
    //         expect(thing).to.have.property("name", "myThingY");
    //     // });
    // } 

    @test "should be able to add a property, read it and write it locally"() {
        let thing : WoT.ExposedThing = WoTServerTest.WoT.expose({
            name : "otherthing"
        });
        // .then(thing => {
            let initp : WoT.ThingPropertyInit = {
                name: "number", 
                writable: true, 
                type: JSON.stringify({ "type": "number" }),
                initValue:  10
            };
            return thing.addProperty(initp).writeProperty("number", 5).then(value => {
                expect(value).to.equal(5);
            })
            .then(() => thing.readProperty("number"))
            .then(value => {
                expect(value).to.equal(5);
            });
        // });
    }

    @test "should be able to add a property, assign it via listener and read it locally"() {
        let thing : WoT.ExposedThing = WoTServerTest.WoT.expose({
            name : "thing3"
        });
        // .then(thing => {
            let initp : WoT.ThingPropertyInit = {
                name: "prop1",
                writable: true,
                type: JSON.stringify({ "type": "number" }),
                initValue: 10
            };
            thing.addProperty(initp);

            let listener = WoTServerTest.server.getListenerFor("/thing3/properties/prop1");
            expect(listener).to.exist;
            listener.should.be.an.instanceOf(listeners.PropertyResourceListener);
            return listener.onWrite({mediaType: undefined, body: new Buffer("5") }).then(() => {
                return thing.readProperty("prop1").then((value) => expect(value).to.equal(5));
            });
        // });
    }

    @test "should be able to add a property, assign it locally and read it via listener"() {
        let thing : WoT.ExposedThing = WoTServerTest.WoT.expose({
            name : "thing4"
        });
        // .then(thing => {
            let initp : WoT.ThingPropertyInit = {
                name: "prop1", 
                writable: true,
                type: JSON.stringify({ "type": "number" }), 
                initValue:  10
            };
            thing.addProperty(initp);

            let listener = WoTServerTest.server.getListenerFor("/thing4/properties/prop1");
            expect(listener).to.exist;
            listener.should.be.an.instanceOf(listeners.PropertyResourceListener);

            return thing.writeProperty("prop1", 23).then((value) => {
                return listener.onRead().then((content) => {
                    content.should.deep.equal({ mediaType: "application/json", body: new Buffer("23") });
                });
            });
        // });
    }

    @test "should be able to add a property, assign and read it via listener"() {
        let thing : WoT.ExposedThing = WoTServerTest.WoT.expose({
            name : "thing5"
        });
        //.then(thing => {
            let initp : WoT.ThingPropertyInit = {
                name: "prop1",
                writable: true, 
                type: JSON.stringify({ "type": "number" }), 
                initValue: 10
            };
            thing.addProperty(initp);

            let listener = WoTServerTest.server.getListenerFor("/thing5/properties/prop1");
            expect(listener).to.exist;
            listener.should.be.an.instanceOf(listeners.PropertyResourceListener);
            return listener.onWrite({mediaType: undefined, body: new Buffer("42") }).then(() => {
                return thing.readProperty("prop1").then((value) => {
                    value.should.equal(42);
                    return listener.onRead().then((content) => {
                        content.body.should.deep.equal(new Buffer("42"));
                    });
                });
            });
        //});
    }

    @test "should be able to add an action and invoke it locally"() {
        let thing : WoT.ExposedThing = WoTServerTest.WoT.expose({
            name : "thing6"
        });
        //.then(thing => {
            let inita : WoT.ThingActionInit = {
                name: "action1",
                inputType: JSON.stringify({ "type": "number" }),
                outputType: JSON.stringify({ "type": "number" }),
                semanticTypes: undefined,
                action : function(request : any) : number {
                    request.should.be.a("number");
                    request.should.equal(23);
                    return 42;
                }
                // action: function(request : any) : any {
                //     request.should.be.a("number");
                //     request.should.equal(23);
                //     return 42;
                // }
            };
            thing.addAction(inita);

            // let request : WoT.Request = {type: undefined, from: null, name: "action1", options : null, data: null, respond : undefined, respondWithError: undefined}; // WoT.RequestType.action, 

            // thing.onInvokeAction({"request" : request, "callback" : request => {
            //     request.should.be.a("number");
            //     request.should.equal(23);
            //     return 42;
            // }});

            return thing.invokeAction("action1", 23).then((result) => result.should.equal(42));
        // })
    }

    @test "should be able to add an action and invoke it locally in ActionInit"() {
        let thing : WoT.ExposedThing = WoTServerTest.WoT.expose({
            name : "thing6b"
        });
        // .then(thing => {
            let inita : WoT.ThingActionInit = {
                name: "action1", 
                inputType: JSON.stringify({ "type": "number" }), 
                outputType: JSON.stringify({ "type": "number" }), 
                semanticTypes: undefined, 
                action: function(newValue: any, oldValue: any) : number {
                    newValue.should.be.a("number");
                    newValue.should.equal(23);
                    return 42;
                }
            };
            thing.addAction(inita);
            
            return thing.invokeAction("action1", 23).then((result) => result.should.equal(42));
        // })
    }

    @test "should be able to add an action and invoke it via listener"() {
        let thing : WoT.ExposedThing = WoTServerTest.WoT.expose({
            name : "thing7"
        });
        // .then(thing => {
            let inita : WoT.ThingActionInit = {
                name: "action1",
                inputType: JSON.stringify({ "type": "number" }),
                outputType: JSON.stringify({ "type": "number" }),
                semanticTypes: undefined,
                action: function(request: any) : number {
                    request.should.be.a("number");
                    request.should.equal(23);
                    return 42;
                }
            };
            thing.addAction(inita);

            // let request : WoT.Request = {type: undefined, from: null, name: "action1", options : null, data: null, respond : undefined, respondWithError: undefined}; // WoT.RequestType.action, 
            // thing.onInvokeAction({"request" : request, "callback" : request => {
            //     request.should.be.a("number");
            //     request.should.equal(23);
            //     return 42;
            // }});
            
            let listener = WoTServerTest.server.getListenerFor("/thing7/actions/action1");
            expect(listener).to.exist;
            listener.should.be.an.instanceOf(listeners.ActionResourceListener);
            
            return listener
            .onInvoke({mediaType: undefined, body: new Buffer("23") })
            .then((resBytes => {
                resBytes.should.deep.equal({ mediaType: "application/json", body: new Buffer("42") });
            }))
        // })
    }
}
