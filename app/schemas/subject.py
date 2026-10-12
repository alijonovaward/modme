from pydantic import BaseModel, ConfigDict


class SubjectCreate(BaseModel):
    name: str


class SubjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
