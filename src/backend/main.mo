import MixinStorage "blob-storage/Mixin";
import Storage "blob-storage/Storage";
import Map "mo:core/Map";
import Text "mo:core/Text";
import Iter "mo:core/Iter";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Array "mo:core/Array";
import Order "mo:core/Order";

actor {
  include MixinStorage();

  type Document = {
    id : Text;
    title : Text;
    description : Text;
    uploaderName : Text;
    uploadedAt : Time.Time;
    blobId : Storage.ExternalBlob;
    fileType : Text;
    fileSize : Nat;
  };

  module Document {
    public func compare(doc1 : Document, doc2 : Document) : Order.Order {
      Text.compare(doc1.title, doc2.title);
    };

    public func matchesSearch(doc : Document, searchTerm : Text) : Bool {
      doc.title.toLower().contains(#text(searchTerm.toLower())) or
      doc.description.toLower().contains(#text(searchTerm.toLower()));
    };
  };

  let documents = Map.empty<Text, Document>();

  public shared ({ caller }) func uploadDocument(
    title : Text,
    description : Text,
    uploaderName : Text,
    blob : Storage.ExternalBlob,
    fileType : Text,
    fileSize : Nat,
  ) : async Text {
    let id = title.concat(" - ").concat(Time.now().toText());
    let document : Document = {
      id;
      title;
      description;
      uploaderName;
      uploadedAt = Time.now();
      blobId = blob;
      fileType;
      fileSize;
    };

    documents.add(id, document);
    id;
  };

  public query ({ caller }) func getAllDocuments() : async [Document] {
    documents.values().toArray().sort();
  };

  public query ({ caller }) func getDocumentById(id : Text) : async Document {
    switch (documents.get(id)) {
      case (null) { Runtime.trap("Document not found") };
      case (?document) { document };
    };
  };

  public shared ({ caller }) func deleteDocument(id : Text) : async () {
    switch (documents.get(id)) {
      case (null) { Runtime.trap("Document not found") };
      case (?_) {
        documents.remove(id);
      };
    };
  };

  public query ({ caller }) func searchDocuments(searchTerm : Text) : async [Document] {
    let filtered = documents.values().filter(
      func(doc) {
        Document.matchesSearch(doc, searchTerm);
      }
    );
    filtered.toArray();
  };
};
